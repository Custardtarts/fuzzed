#pragma once
#include "StaticGate.h"

class ANDGate : public StaticGate
{
public:
	ANDGate(const std::string& id, const std::string& name = "");
	virtual ~ANDGate(void);

	virtual FaultTreeNode* clone() const override; // virtual deep copying

	virtual int serializePTNet(std::shared_ptr<PNDocument> doc) const override;
	virtual std::string serializeAsFormula(std::shared_ptr<PNDocument> doc) const override;

protected:
	virtual void initActivationFunc() override;
};