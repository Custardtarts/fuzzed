#pragma once

#include "DynamicGate.h"

class FDEPGate : public DynamicGate
{
public:
	FDEPGate(const std::string& id, const std::string& trigger, std::vector<std::string> dependentEvents, const std::string& name = "");
	virtual ~FDEPGate(void) {};

	virtual int serializePTNet(std::shared_ptr<PNDocument> doc) const override;

	virtual FaultTreeNode::Ptr clone() const override; // virtual deep copying

protected:
	std::string m_triggerID;
	std::vector<std::string> m_dependentEvents;
};
