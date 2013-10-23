#include "SimulationProxy.h"
#include "implementation/TimeNETSimulation.h"
#include "implementation/PetriNetSimulation.h"

#include "serialization/PNMLDocument.h"
#include "serialization/TNDocument.h"
#include "events/TopLevelEvent.h"
#include "FuzzTreeTransform.h"
#include "FaultTreeConversion.h"

#include "util.h"
#include "xmlutil.h"
#include "Config.h"
#include "Constants.h"
#include "CommandLineParser.h"

#include <omp.h>

// Generated files...
#include "faulttree.h"
#include "fuzztree.h"
#include "simulationResult.h"

#include <boost/filesystem/path.hpp>
#include <boost/filesystem/operations.hpp>
#include <boost/foreach.hpp>
#include <boost/range/counting_range.hpp>

#include <map>
#include <set>
#include <iostream>
#include <fstream>

namespace po = boost::program_options;
namespace fs = boost::filesystem;

SimulationProxy::SimulationProxy(int argc, char** arguments) :
	m_numRounds(0),
	m_convergenceThresh(0.0),
	m_simulationTime(0),
	m_bSimulateUntilFailure(true),
	m_numAdaptiveRounds(0),
	m_timeNetProperties(nullptr)
{
	try
	{
		// parseCommandline(argc, arguments);
		parseCommandline_default(argc, arguments);
	}
	catch (const exception& e)
	{
		std::cerr << "Exception when invoking simulation: " << e.what();
	}
	catch (...)
	{
		std::cerr << "Unknown exception when invoking simulation";
	}
}

SimulationProxy::SimulationProxy(unsigned int numRounds, double convergenceThreshold, unsigned int maxTime) : 
	m_numRounds(numRounds),
	m_convergenceThresh(convergenceThreshold),
	m_simulationTime(maxTime),
	m_bSimulateUntilFailure(true),
	m_numAdaptiveRounds(0),
	m_timeNetProperties(nullptr)
{}

SimulationResultStruct SimulationProxy::runSimulationInternal(
	const boost::filesystem::path& petriNetFile,
	const boost::filesystem::path& outPath,
	const boost::filesystem::path& workingDir,
	SimulationImpl implementationType,
	void* additionalArguments) 
{
	Simulation* sim;
	SimulationResultStruct res;
	switch (implementationType)
	{
	case TIMENET:
		{
			assert(additionalArguments != nullptr);
			// TODO make this produce rubbish output only in workingDir
			sim = new TimeNETSimulation(petriNetFile, m_simulationTime, m_missionTime, m_numRounds, additionalArguments);
			break;
		}
	case DEFAULT:
		{
			sim = new PetriNetSimulation(
				petriNetFile,
				m_simulationTime, 
				m_missionTime, 
				m_numRounds,
				m_convergenceThresh,
				m_bSimulateUntilFailure,
				m_numAdaptiveRounds);

			break;
		}
	default:
		assert(false);
	}
	
	try
	{
#ifdef MEASURE_SPEEDUP
		for (int i : boost::counting_range(1, omp_get_max_threads()))
		{
			omp_set_num_threads(i);
//			cout << "*** " << i << "THREADS ***" << endl;
			sim->run();
		}
#else
		sim->run();
		if (implementationType == DEFAULT)
			res = ((PetriNetSimulation*)sim)->result();
#endif
	}
	catch (exception& e)
	{
		cout << "Exception during simulation: " << e.what(); 
	}
	catch (...)
	{
		cout << "Unknown Exception during simulation";
	}
	
	delete sim;
	return res;
}

void SimulationProxy::parseCommandline(int numArguments, char** arguments)
{
	string directoryName, filePath;
	bool useTimeNET;
	int confidence;
	float epsilon;

	m_options.add_options()
		("help,h", "produce help message")
		("TN",			po::value<bool>(&useTimeNET)->default_value(false),									"Use TimeNET simulation")
		("file,f",		po::value<string>(&filePath),														"Path to FuzzTree or PNML file")
		("dir,d",		po::value<string>(&directoryName),													"Directory containing FuzzTree or PNML files")
		("time,t",		po::value<unsigned int>(&m_simulationTime)->default_value(DEFAULT_SIMULATION_TIME),	"Maximum Simulation Time in milliseconds")
		("steps,s",		po::value<unsigned int>(&m_missionTime)->default_value(DEFAULT_SIMULATION_STEPS),	"Number of Simulation Steps")
		("rounds,r",	po::value<unsigned int>(&m_numRounds)->default_value(DEFAULT_SIMULATION_ROUNDS),	"Number of Simulation Rounds")
		("conf",		po::value<int>(&confidence)->default_value(DEFAULT_CONFIDENCE),						"Confidence level (TimeNET only)")
		("epsilon,e",	po::value<float>(&epsilon)->default_value(DEFAULT_EPSILON),							"Epsilon (TimeNET only)")
		("MTTF",		po::value<bool>(&m_bSimulateUntilFailure)->default_value(true),						"Simulate each Round until System Failure, necessary for MTTF")
		("converge,c",	po::value<double>(&m_convergenceThresh)->default_value((double)0.0000),				"Cancel simulation after the resulting reliability differs in less than this threshold");

	po::variables_map optionsMap;
	po::store(po::parse_command_line(numArguments, arguments, m_options), optionsMap);
	po::notify(optionsMap);

	if (optionsMap.count("help")) 
	{
		cout << m_options << endl;
		return;
	}

	if (useTimeNET)
	{
		m_timeNetProperties = new TimeNETProperties();
		m_timeNetProperties->filePath = filePath;
		m_timeNetProperties->seed = rand();
		m_timeNetProperties->confLevel = confidence;
		m_timeNetProperties->epsilon = epsilon;
	}

	const bool bDir = optionsMap.count("dir") > 0;
	const bool bFile = optionsMap.count("file") > 0;
	if (!bDir && !bFile)
	{
		cout << "Please specify either a directory or a file" << endl;
		cout << m_options << endl;
		return;
	}

	if (bDir)
	{
		const auto dirPath = fs::path(directoryName.c_str());
		if (!is_directory(dirPath))
			throw runtime_error("Not a directory: " + directoryName);

		fs::directory_iterator it(dirPath), eod;
		BOOST_FOREACH(fs::path const &p, std::make_pair(it, eod))   
		{
			if (is_regular_file(p) && acceptFileExtension(p))
				simulateFile(p, useTimeNET ? TIMENET : DEFAULT);
		}
	}
	else if (bFile)
	{
		const auto fPath = fs::path(filePath.c_str());
		if (!is_regular_file(fPath))
			throw runtime_error("Not a file: " + filePath);

		simulateFile(fPath, useTimeNET ? TIMENET : DEFAULT);
	}
}

void SimulationProxy::simulateFile(const fs::path& p, SimulationImpl impl)
{	
	auto ext = p.generic_string();
	ext = ext.substr(ext.find_last_of("."), ext.length());

	std::string outFile = p.generic_string();
	std::string workingDir = p.generic_string();
	util::replaceFileExtensionInPlace(outFile, ".xml");
	util::replaceFileExtensionInPlace(workingDir, "");
	
	if (ext == fuzzTree::FUZZ_TREE_EXT)
		simulateAllConfigurations(p, outFile, workingDir, impl);

	else if (ext == faultTree::FAULT_TREE_EXT)
	{
		ifstream file(p.generic_string(), ios::in | ios::binary);
		if (!file.is_open())
		{
			std::cerr << "Could not open file: " << p.generic_string() << std::endl;
		}

		const auto simTree = faulttree::faultTree(file, xml_schema::Flags::dont_validate);
		std::shared_ptr<TopLevelEvent> ft = fromGeneratedFaultTree(simTree->topEvent()); 
		// ft->print(cout);

		string pnFile = p.generic_string();
		util::replaceFileExtensionInPlace(pnFile, (impl == DEFAULT) ? PNML::PNML_EXT : timeNET::TN_EXT);
		simulateFaultTree(ft, p, outFile, workingDir, impl);
	}
}

bool SimulationProxy::acceptFileExtension(const boost::filesystem::path& p)
{
	return
		p.extension() == PNML::PNML_EXT ||
		p.extension() == fuzzTree::FUZZ_TREE_EXT ||
		p.extension() == faultTree::FAULT_TREE_EXT ||
		p.extension() == timeNET::TN_EXT;
}

SimulationResultStruct SimulationProxy::simulateFaultTree(
	std::shared_ptr<TopLevelEvent> ft,
	const boost::filesystem::path& input,
	const boost::filesystem::path& output,
	const boost::filesystem::path& workingDir,
	SimulationImpl impl)
{
	std::shared_ptr<PNDocument> doc;

	m_missionTime = ft->getMissionTime();
	if (m_missionTime <= 1) // TODO: print simulation warning here!
		std::cout 
			<< "Warning: Components are assumed to fail one at the time."
			<< "For a very short mission time, possible failures may never occur." 
			<< std::endl;

	switch (impl)
	{
	case DEFAULT:
		doc = std::shared_ptr<PNMLDocument>(new PNMLDocument());
		ft->serializePTNet(doc);
		break;
	case TIMENET:
		m_timeNetProperties->maxExecutionTime = m_simulationTime;
		m_timeNetProperties->transientSimTime = m_missionTime;
	case STRUCTUREFORMULA_ONLY:
		auto TNdoc = std::shared_ptr<TNDocument>(new TNDocument());
		ft->serializeTimeNet(TNdoc);
		// std::cout << ft->serializeAsFormula(TNdoc) << endl; // TODO: provide a StructureFormulaResultDocument
		doc = TNdoc;
		break;
	}

	if (impl == STRUCTUREFORMULA_ONLY)
		return SimulationResultStruct();

	std::string petriNetFile = workingDir.generic_string() + util::fileNameFromPath(input.generic_string());
	util::replaceFileExtensionInPlace(petriNetFile, (impl == DEFAULT) ? PNML::PNML_EXT : timeNET::TN_EXT);

	doc->save(petriNetFile);
	return runSimulationInternal(petriNetFile, output, workingDir, impl, m_timeNetProperties);
}

void SimulationProxy::simulateAllConfigurations(
	const fs::path& inputFile,
	const fs::path& outputFile,
	const fs::path& workingDir,
	SimulationImpl impl)
{
	const auto inFile = inputFile.generic_string();
	ifstream file(inFile, ios::in | ios::binary);
	if (!file.is_open())
		throw runtime_error("Could not open file");

	simulationResults::SimulationResults simResults;

	FuzzTreeTransform ftTransform(file);
	if (!ftTransform.isValid())
	{
		const auto simTree = faulttree::faultTree(inputFile.generic_string(), xml_schema::Flags::dont_validate);
		std::shared_ptr<TopLevelEvent> ft = fromGeneratedFaultTree(simTree->topEvent()); 
		if (ft)
		{ // in this case there is only a faulttree, so no configuration information will be serialized
		
			SimulationResultStruct res = simulateFaultTree(ft, inputFile, outputFile, workingDir, impl);
			simulationResults::Result r(
				ft->getId(),
				util::timeStamp(),
				ft->getCost(),
				res.reliability,
				res.nFailures,
				res.nRounds);

			r.availability(res.meanAvailability);
			r.duration(res.duration);
			r.mttf(res.mttf);
		}
		else
			std::cerr << "Could handle fault tree file: " << inFile << endl;
			
		return;
	}

	for (const auto& ft : ftTransform.transform())
	{
		std::shared_ptr<TopLevelEvent> simTree = fromGeneratedFuzzTree(ft.second.topEvent());
		{
			auto res = simulateFaultTree(simTree, inputFile, outputFile, workingDir, impl);
			simTree->print(cout);

			simulationResults::Result r(
				simTree->getId(),
				util::timeStamp(),
				simTree->getCost(),
				res.reliability,
				res.nFailures,
				res.nRounds);

			r.availability(res.meanAvailability);
			r.duration(res.duration);
			r.mttf(res.mttf);

			r.configuration(serializedConfiguration(ft.first));
			simResults.result().push_back(r);
		}
	}

	std::ofstream output(outputFile.generic_string());
	simulationResults::simulationResults(output, simResults);
}

void SimulationProxy::parseCommandline_default(int numArguments, char** arguments)
{
	// TODO: command line options
	m_numRounds = DEFAULT_SIMULATION_ROUNDS;
	m_simulationTime = DEFAULT_SIMULATION_TIME;
	
	CommandLineParser parser;
	parser.parseCommandline(numArguments, arguments);
	simulateAllConfigurations(parser.getInputFilePath(), parser.getOutputFilePath(), parser.getWorkingDirectory(), DEFAULT);
}
