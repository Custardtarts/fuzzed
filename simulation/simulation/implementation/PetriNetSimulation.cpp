#include "PetriNetSimulation.h"
#include "util.h"
#include "Config.h"
#include "ResultDocument.h"
#include "petrinet/PNMLImport.h"
#include "petrinet/PetriNet.h"

#include <chrono>
#include <omp.h>
#include <math.h>
#include <boost/format.hpp>
#include <boost/filesystem.hpp>

using namespace chrono;
using boost::format;

bool PetriNetSimulation::run()
{	
	unsigned int numFailures = 0;
	unsigned long sumFailureTime_all = 0;
	unsigned long sumFailureTime_fail = 0;
	unsigned int count = 0;

	const PetriNet* const pn = PNMLImport::loadPNML(m_netFile.generic_string());
	if (!pn) 
		throw runtime_error("Import was not successful.");
	else if (!pn->valid()) 
		throw runtime_error("Invalid Petri Net.");
	
	SimulationResult res;
	if (pn->m_activeTimedTransitions.size() == 0)
	{ // perfectly reliable
		printResults(res);
		writeResultXML(res);
		return true;
	}

	cout <<  "----- Starting " << m_numRounds << " simulation rounds in " << omp_get_max_threads() << " threads...";

	// for checking local convergence, thread-local
	long double privateLast = 10000.0L;
	bool privateConvergence = false;
	bool privateBreak = false;

	// for checking global convergence, shared variable
	bool globalConvergence = true;
	
	const double startTime = omp_get_wtime();

	// sum up all the failures from all simulation rounds in parallel, counting how many rounds were successful
#pragma omp parallel for reduction(+:numFailures, count, sumFailureTime_all, sumFailureTime_fail) reduction(&: globalConvergence) firstprivate(privateLast, privateConvergence, privateBreak) schedule(dynamic) if (m_numRounds > PAR_THRESH)
	for (int i = 0; i < m_numRounds; ++i)
	{
		if (privateBreak)
			continue;
		
		PetriNet currentNet(std::move(*pn));
		SimulationRoundResult res = runOneRound(&currentNet);
		
		if (res.valid)
		{
			++count;
			sumFailureTime_all += res.failureTime;
			
			if (res.failed && res.failureTime <= m_numSimulationSteps)
			{ // the failure occurred before the end of mission time -> add up to compute R(mission time)
				++numFailures;
				sumFailureTime_fail += res.failureTime;
			}

			const long double current = (count == 0) ? 0 : ((long double)numFailures/(long double)count);
			const long double diff = std::abs(privateLast - current);

			if ((current > 0.0L) && (current < 1.0L) && (diff < m_convergenceThresh))
			{
				privateConvergence = true;
				globalConvergence &= privateConvergence;
				
				#pragma omp flush(globalConvergence)
				if (globalConvergence)
					privateBreak = true;
			}
			privateLast = current;
		}
	}

	const double endTime = omp_get_wtime();

	long double unreliability		= (long double)numFailures			/(long double)count;
	long double avgFailureTime_all	= (long double)sumFailureTime_all	/(long double)count;
	long double avgFailureTime_fail = (long double)sumFailureTime_fail	/(long double)numFailures;
	long double meanAvailability	= avgFailureTime_fail				/(long double)m_numSimulationSteps;
	
	cout << "...done." << endl;

	res.reliability			= 1.0 - unreliability;
	res.meanAvailability	= meanAvailability;
	res.nFailures			= numFailures;
	res.nRounds				= count;
	res.mttf				= avgFailureTime_all;
	res.duration			= endTime - startTime;

	printResults(res);
	writeResultXML(res);

	return true;
}

PetriNetSimulation::PetriNetSimulation(
	const boost::filesystem::path& path,
	const string& outputFileName, 
	int simulationTime,		// the maximum duration of one simulation in seconds
	int simulationSteps,	// the number of logical simulation steps performed in each round
	int numRounds,
	double convergenceThresh,
	bool simulateUntilFailure	/*= false*/,
	int numAdaptiveRounds		/*= 0*/)
	: Simulation(path, simulationTime, simulationSteps, numRounds), 
	m_outStream(nullptr),
	m_outputFileName(outputFileName),
	m_simulateUntilFailure(simulateUntilFailure),
	m_numAdaptiveRounds(numAdaptiveRounds),
	m_convergenceThresh(convergenceThresh)
{
	assert(!m_netFile.empty());
	
	if (!outputFileName.empty())
	{
		m_outStream = new ofstream(outputFileName+ ".log");
		m_debugOutStream = new ofstream(outputFileName+".debug");
	}

	cout << "Results will be written to " << outputFileName << endl;
}

void PetriNetSimulation::simulationStep(PetriNet* pn, int tick)
{
	tryTimedTransitions(pn, tick);
	
	// propagate all failures upwards in the correct time step
	bool immediateCanFire = true;
	while (immediateCanFire)
		tryImmediateTransitions(pn, tick, immediateCanFire);

	vector<TimedTransition*> toRemove;
	for (TimedTransition* tt : pn->m_inactiveTimedTransitions)
	{
		if (tt->tryUpdateStartupTime(tick))
		{
			toRemove.emplace_back(tt);
			pn->updateFiringTime(tt);
		}
	}
	for (TimedTransition* tt : toRemove)
		pn->m_inactiveTimedTransitions.erase(tt);
}

SimulationRoundResult PetriNetSimulation::runOneRound(PetriNet* net)
{
	const int maxTime = m_simulationTimeSeconds*1000;
	const auto start = high_resolution_clock::now();

	SimulationRoundResult result;
	if (net->constraintViolated())
	{
		result.valid = false;
		return result;
	}
	result.failed = false;
	result.failureTime = m_numSimulationSteps;
	result.valid = true;

	auto elapsedTime = duration_cast<milliseconds>(high_resolution_clock::now()-start).count();
	try
	{
		int nextStep = 0;//= net->nextFiringTime(0);
		while ((nextStep <= m_numSimulationSteps || m_simulateUntilFailure)  && elapsedTime < maxTime)
		{
			elapsedTime = duration_cast<milliseconds>(high_resolution_clock::now()-start).count();
			simulationStep(net, nextStep);
			if (net->failed())
			{
				result.failureTime = nextStep;
				result.failed = true;
				break;
			}
			else if (nextStep == net->finalFiringTime() && !net->hasInactiveTransitions())
			{ // there are configurations where the tree can no longer fail!
				result.failureTime = m_numSimulationSteps; 
				result.failed = false;
				break;
			}
			nextStep = net->nextFiringTime(nextStep);
		}
	}
	catch (const exception& e)
	{
		(m_outStream ? *m_outStream : cout) << "Exception during Simulation" << e.what() << endl;
		result.valid = false;
	}
	catch (...)
	{
		(m_outStream ? *m_outStream : cout) << "Unknown Exception during Simulation" << endl;
		result.valid = false;
	}
	return result;
}

PetriNetSimulation::~PetriNetSimulation()
{}

void PetriNetSimulation::tryImmediateTransitions(PetriNet* pn, int tick, bool& immediateCanFire)
{
	for (ImmediateTransition& t : pn->m_immediateTransitions)
	{
		if (t.wantsToFire(tick))
			t.tryToFire();
	}

	immediateCanFire = false;
	for (auto& p : pn->m_placeDict)
	{
		if (p.second.hasRequests())
		{
			p.second.resolveConflictsImmediate(tick);
			immediateCanFire = true;
		}
	}
}

void PetriNetSimulation::tryTimedTransitions(PetriNet* pn, int tick)
{
	for (auto& t : pn->m_activeTimedTransitions)
	{
		if (t.second->wantsToFire(tick))
			t.second->tryToFire();
	}

	for (auto& p : pn->m_placeDict)
	{
		if (p.second.hasRequests())
			p.second.resolveConflictsTimed(tick);
	}
}

void PetriNetSimulation::printResults(const SimulationResult& res)
{
	string results = str(
		format("----- File %1%, %2% simulations with %3% simulated time steps \n \
			   #Failures: %4% out of %5% \n \
			   Reliability: %6% \n \
			   Mean Availability (failing runs): %9% \n \
			   MTTF: %7% \n \
			   Simulation Duration %8% seconds") 
			   % m_netFile.generic_string()
			   % m_numRounds
			   % m_numSimulationSteps
			   % res.nFailures % res.nRounds
			   % res.reliability
			   % (m_simulateUntilFailure ? util::toString(res.mttf) : "N/A")
			   % res.duration
			   % res.meanAvailability);

	(*m_outStream) << results << endl;
	m_outStream->close();

	cout << results << endl << endl;
}

void PetriNetSimulation::writeResultXML(const SimulationResult& res)
{
	ResultDocument doc;
	doc.setResult(res);
	doc.save(m_outputFileName + ".xml");
}
