#pragma once
#include "Simulation.h"

using namespace std;

struct TimeNETProperties
{
	string filePath; // the petri net file
	
	int transientSimTime;
	int confLevel;
	
	float epsilon;
	int seed;
	int maxExecutionTime;
};

class TimeNETSimulation : public Simulation
{
public:
	TimeNETSimulation(
		const boost::filesystem::path& p, 
		int simulationTime, // the maximum duration of one simulation in seconds
		int simulationSteps, // the number of logical simulation steps performed in each round
		int numRounds,
		void* additionalArgmuments);

	TimeNETSimulation(
		std::shared_ptr<FaultTreeNode> faultTree, 
		int simulationTime, // the maximum duration of one simulation in seconds
		int simulationSteps, // the number of logical simulation steps performed in each round
		int numRounds,
		void* additionalArgmuments);

	virtual ~TimeNETSimulation();

	virtual bool run() override;

	void parseReliability(double& res);

protected:
	TimeNETProperties* m_properties;
};