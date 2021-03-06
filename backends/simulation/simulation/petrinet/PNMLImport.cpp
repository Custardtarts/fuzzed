#include <iostream>

#include "PNMLImport.h"
#include "Constants.h"
#include "PetriNet.h"
#include "util.h"
#include "gates/SEQGate.h"

using namespace PNML;
using namespace std;
using namespace pugi;

/************************************************************************/
/* XML                                                                  */
/************************************************************************/

int		parseIntegerValue(const pugi::xml_node& node, const std::string& type, const int defaultValue);
double	parseDoubleValue(const pugi::xml_node& node, const std::string& type, const double defaultValue);
bool	parseBooleanValue(const pugi::xml_node& node, const std::string& type, const bool defaultValue);

bool parseBooleanValue(const xml_node& node, const string& type, const bool defaultValue)
{
	const xml_node valNode = node.child(type.c_str());
	if (valNode.empty())
		return defaultValue;

	const xml_node child = valNode.child("value");
	if (child.empty())
		throw runtime_error("Value node not found");

	return child.text().as_bool(defaultValue);
}

double parseDoubleValue(const xml_node& node, const string& type, const double defaultValue)
{
	const xml_node valNode = node.child(type.c_str());
	if (valNode.empty())
		return defaultValue;

	const xml_node child = valNode.child("value");
	if (child.empty())
		throw runtime_error("Value node not found");

	return child.text().as_double(defaultValue);
}

int parseIntegerValue(const xml_node& node, const string& type, const int defaultValue)
{
	xml_node valNode = node.child(type.c_str());
	if (!valNode)
		return defaultValue;

	xml_node child = valNode.child("value");
	if (!child)
		throw runtime_error("Value node not found");

	return child.text().as_int(defaultValue);
}

/************************************************************************/
/*                                                                      */
/************************************************************************/


PetriNet* PNMLImport::loadPNML(const string& fileName) noexcept
{
	try
	{
		PNMLImport import(fileName);
		
		if (!import.validateAndLoad())
			throw runtime_error(string("Could not load ") + fileName);

		map<string, Place> placeDict;
		import.loadPlaces(placeDict);

		ArcList arcList;
		import.loadArcs(arcList);

		vector<ImmediateTransition> immediateTransitions; 
		vector<TimedTransition>		timedTransitions;
		import.loadTransitions(immediateTransitions, timedTransitions);

		string userDescription;
		import.loadUserDescription(userDescription);
		if (!userDescription.empty())
			cout << "DESCRIPTION:  " << userDescription << endl;

		return new PetriNet(immediateTransitions, timedTransitions, placeDict, arcList);
	}
	catch (const exception& e)
	{
		cout << "Problem during PNML import: " << e.what() << endl;
		return nullptr;
	}
}

PNMLImport::PNMLImport(const string& fileName) : XMLImport(fileName)
{}

bool PNMLImport::loadRootNode()
{
	m_rootNode = m_document.child(PNML_TAG);
	if (!m_rootNode)
		return false;
	m_rootNode = m_rootNode.child(ROOT_TAG);

	return !m_rootNode.empty();
}

void PNMLImport::loadPlaces(map<string, Place>& places)
{
	for (const xml_node& child : m_rootNode.children(PLACE_TAG))
	{
		const int initialMarking = parseIntegerValue(child, INITIALMARKING_TAG, 0);
		const string ID = child.attribute(ID_ATTRIBUTE).as_string();
		const bool isTopLevel = child.attribute(TOPLEVEL_TAG).as_bool(false);
		const bool isConstraint = child.attribute(CONSTRAINT_TAG).as_bool(false);

		const int capacity = parseIntegerValue(child, CAPACITY_TAG, 0);
		places.insert(make_pair(ID, 
			Place(
			ID, initialMarking, capacity, 
			isTopLevel ? TOP_LEVEL_PLACE : isConstraint ? CONSTRAINT_VIOLATED_PLACE : DEFAULT_PLACE)));
	}
}

void PNMLImport::loadArcs(ArcList& arcs)
{
	for (const xml_node& childNode : m_rootNode.children(ARC_TAG))
	{
		const string src = childNode.attribute(SOURCE_TAG).as_string();
		const string dst = childNode.attribute(TARGET_TAG).as_string();
		
		int weight = 1;
		bool isInhibitor = false;

		const xml_node valNode = childNode.child(INSCRIPTION_TAG);
		if (!valNode.empty())
		{ // in the inscription node, the number of tokens is written comma-separated from the token type
			xml_node c = valNode.child(VALUE_TAG);
			if (!valNode)
				throw runtime_error("Value node not found");

			vector<int> results;
			util::tokenizeIntegerString(c.text().as_string(""), results);
			weight = results.back();
		}

		const xml_node typeNode = childNode.child(TYPE_TAG);
		if (!typeNode.empty())
		{
			if (string(typeNode.attribute(VALUE_TAG).as_string()) == INHIBITOR_ATTR)
				isInhibitor = true;
		}

		arcs.emplace_back(src, dst, weight, isInhibitor ? INHIBITOR_ARC : NORMAL_ARC);
	}
}

void PNMLImport::loadTransitions(
	vector<ImmediateTransition>& immediateTransitions, 
	vector<TimedTransition>& timedTransitions)
{
	for (const xml_node& child : m_rootNode.children(TRANSITION_TAG))
	{
		const string ID = child.attribute(ID_ATTRIBUTE).as_string();
		if (parseBooleanValue(child, TIMED_TAG, false))
		{ // timedTransition
			const double rate = parseDoubleValue(child, RATE_TAG, -1.0);
			if (rate < 0.0)
				throw runtime_error("Invalid rate for transition detected");

			timedTransitions.emplace_back(ID, rate);
		}
		else
		{ // immediateTransition
			const double rate = parseDoubleValue(child, RATE_TAG, 1.0);
			const int prio = parseIntegerValue(child, PRIORITY_TAG, 1);
			immediateTransitions.emplace_back(ID, rate, prio);
		}
	}
}

void PNMLImport::loadUserDescription(string& description)
{
	const xml_node child  = m_rootNode.child(USER_DESCRIPTION_LABEL);
	if (!child.empty())
		description = child.text().as_string("");
}



PNMLImport::~PNMLImport()
{}