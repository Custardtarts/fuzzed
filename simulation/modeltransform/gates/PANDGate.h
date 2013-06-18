#pragma once
#include "DynamicGate.h"
#include <set>

/************************************************************************/
/* Fail if the first child fails before the second one					*/
/* the order being defined by the insertion order in the child list		*/
/************************************************************************/

class PANDGate : public DynamicGate
{
public:
	PANDGate(const std::string& id, const std::vector<std::string>& ordering, const std::string& name = "");
	virtual ~PANDGate(void) {};

	virtual FaultTreeNode* clone() const override; // virtual deep copying

	virtual int serialize(boost::shared_ptr<PNDocument> doc) const override;

protected:
	virtual int addSequenceViolatedPlace(boost::shared_ptr<PNDocument> doc) const;

	std::vector<std::string> m_prioIDs;
};