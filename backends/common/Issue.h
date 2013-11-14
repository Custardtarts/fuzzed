#pragma once

#include <string>
#include "commonTypes.h"

struct Issue
{
public:
	static Issue warningIssue(const std::string& msg, const int issueId = 0, const std::string elementId = "");
	static Issue fatalIssue(const std::string& msg, const int issueId = 0, const std::string elementId = "");

	commonTypes::Issue serialized();

protected:
	Issue(const std::string& msg, const int issueId = 0, const std::string elementId = "");

	int m_issueId;
	std::string m_elementId;
	std::string m_message;
	bool m_bFatal;
};