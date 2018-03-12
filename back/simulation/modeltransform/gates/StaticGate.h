#pragma once
#include <boost/function.hpp>
#include <map>
#include "Gate.h"

typedef std::map<const std::string/*ID*/, double/*value*/> NodeValueMap;

class StaticGate : public Gate
{
public:
	StaticGate(const std::string& ID, const std::string& name);
	virtual ~StaticGate() {}

	virtual double computeUnreliability() const;
	
protected:
	bool hasDynamicChildren() const;

	virtual void initActivationFunc() = 0;

	// from all the input values, compute the value of the gate. only for static gates.
	boost::function<double (NodeValueMap)> m_activationFunc;

	static const std::string s_formulaBegin;
	static const std::string s_formulaEnd;
	static const std::string s_ORoperator;
	static const std::string s_ANDoperator;
	static const std::string s_NOToperator;
};