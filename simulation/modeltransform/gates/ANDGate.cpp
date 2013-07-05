#include "ANDGate.h"
#include <vector>
#include "serialization/PNDocument.h"
#include "util.h"

using namespace std;

ANDGate::ANDGate(const string& id, const string& name /*= ""*/)
	: StaticGate(id, name)
{
	initActivationFunc();
}

int ANDGate::serialize(boost::shared_ptr<PNDocument> doc) const 
{
	vector<int> childIDs;
	for (auto it = getChildrenBegin(); it != getChildrenEnd(); ++it)
		childIDs.emplace_back((*it)->serialize(doc));
	
	int triggerGate = doc->addImmediateTransition();
	for (int id : childIDs)
	{
		if (id < 0)
		{
			cout << "Invalid child found, ID: " << id << endl;
			continue;
		}
		doc->placeToTransition(id, triggerGate);
	}
	
	int allChildrenFailed = doc->addPlace(0, 1, "AND_Failed");
	doc->transitionToPlace(triggerGate, allChildrenFailed);
	
	// cout << "Value of AND: " << getValue() << endl;

	return allChildrenFailed;
}

ANDGate::~ANDGate(void)
{}

FaultTreeNode* ANDGate::clone() const
{
	FaultTreeNode* newNode = new ANDGate(m_id, m_name);
	for (auto& child : m_children)
		newNode->addChild(child->clone());

	return newNode;
}

std::string ANDGate::serializeAsFormula(boost::shared_ptr<PNDocument> doc) const 
{
	const static string ANDoperator = " && ";

	string result = formulaBegin;

	auto it = getChildrenBegin();
	result += (*it)->serializeAsFormula(doc);
	++it;
	while (it != getChildrenEnd())
	{
		result += ANDoperator;
		result += (*it)->serializeAsFormula(doc);
		++it;
	}
	return result + formulaEnd;
}

void ANDGate::initActivationFunc()
{
	m_activationFunc = [](NodeValueMap childValues) -> long double 
	{
		long double result = 1.0;
		for (const auto& p : childValues)
			result *= p.second;

		return result;
	};
}
