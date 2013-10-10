#pragma once
#include "PNDocument.h"
#include "Types.h"

#include <map>
#include <tuple>
#include <fstream>
#include <string>

struct TN_TransitionSpec 
{
	TN_TransitionSpec() {}
	TN_TransitionSpec(const std::string& description) : transitionDescription(description) {}

	std::string transitionDescription;

	std::vector<std::string> inputArcs;
	std::vector<std::string> outputArcs;
	std::vector<std::string> inhibitArcs;
};

class TNDocument : public PNDocument
{
public:
	TNDocument();
	virtual ~TNDocument();

	virtual int addTimedTransition(long double rate, const std::string& label = "") override;
	// add a transition whose exponential delay depends on a definition
	virtual int addParametrisedTransition(const std::string& dependencyTerm); 

	virtual int addImmediateTransition(unsigned int priority = 1, const std::string& label = "") override;
	virtual int addGuardedTransition(const std::string& guard, unsigned int priority = 1);

	virtual int addTopLevelPlace(const std::string&) override;
	virtual int addPlace(int initialMarking, int capacity = 1,  const std::string& label = "", PlaceSemantics semantics = DEFAULT_PLACE) override;

	virtual void addInhibitorArc(int inhibitingPlace, int inhbitedTransition, int tokenCount = 0) override;
	virtual void addDefinition(const std::string& name, const double& val);

	virtual bool save(const std::string& fileName) override;

protected:
	virtual void addArc(int placeID, int transitionID, int tokenCount, ArcDirection direction, const std::string& inscription = "x") override;
	
	void addEnablingFunction(const std::string& id, const std::string& guard);
	void addParametrisedDelay(const std::string& transitionID, const std::string& delayTerm);

	void writeHeader();

	static inline const std::string transitionString(const TN_TransitionSpec& spec);
	static inline const std::string transitionIdentifier(const int& id);
	static inline const std::string placeIdentifier(const int& id);
	
	std::map<std::string, TN_TransitionSpec> m_transitions;
	std::map<std::string, std::string> m_places;
	
	std::vector<std::string> m_measures;
	std::vector<std::string> m_enablingFunctions;
	std::vector<std::string> m_definitions;
	std::vector<std::string> m_delays;
};