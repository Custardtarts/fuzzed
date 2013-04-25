#pragma once
#include "Transition.h"

class ImmediateTransition : public Transition
{
public:
	typedef boost::shared_ptr<ImmediateTransition> Ptr;

	ImmediateTransition(const std::string& id, double rate, double priority);

	// copying
	ImmediateTransition(const ImmediateTransition& other);
	ImmediateTransition& operator= (const ImmediateTransition &other);

	double getPriority() const { return m_priority; };

protected:
	virtual bool stochasticallyEnabled(int tick) override;

	double m_rate;
	double m_priority;
};