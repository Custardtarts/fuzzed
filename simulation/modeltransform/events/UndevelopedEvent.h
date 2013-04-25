#pragma once
#include "Event.h"

class UndevelopedEvent : public Event
{
public:
	UndevelopedEvent(int ID, long double failureRate, const std::string& name = "");
	virtual ~UndevelopedEvent() {};

	virtual FaultTreeNode* clone() const override; // virtual deep copying

	virtual int serialize(boost::shared_ptr<PNDocument> doc) const override;
	virtual void addChild(FaultTreeNode* child) override;
};