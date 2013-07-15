#include "UndevelopedEvent.h"
#include <cassert>
#include "serialization/PNDocument.h"
#include "util.h"

int UndevelopedEvent::serializePTNet(boost::shared_ptr<PNDocument> doc) const 
{
	int placeID = doc->addPlace(1, 1, "UndevelopedEvent" + m_id);
	int transitionID = doc->addTimedTransition(m_failureRate);
	doc->placeToTransition(placeID, transitionID);
	placeID = doc->addPlace(0, 1);
	doc->transitionToPlace(transitionID, placeID);

	return placeID;
}

UndevelopedEvent::UndevelopedEvent(const std::string& ID, long double failureRate, const string& name /*= ""*/) 
	: Event(ID, failureRate, name)
{}

void UndevelopedEvent::addChild(FaultTreeNode*)
{
	assert(false && "This is a leaf node!");
}

FaultTreeNode* UndevelopedEvent::clone() const
{
	return new UndevelopedEvent(m_id, m_failureRate, m_name);
}
