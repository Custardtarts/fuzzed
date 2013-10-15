#include "AbstractResultDocument.h"

#include <cassert>

using namespace pugi;
using std::string;

namespace
{
	const char* const RES_ERROR		= "Error";
	const char* const RES_WARNING	= "Warning";
	const char* const ISSUE_ID		= "issueId";
	const char* const ELEMENT_ID	= "elementId";
	const char* const MODELID		= "modelId";
	const char* const TIMESTAMP		= "timestamp";
	const char* const KEY = "key";
	const char* const VALUE = "value";
	
	const char* const NAMESPACE = ""; // TODO
}

AbstractResultDocument::AbstractResultDocument(const std::string rootNodeName) : xml_document(),
	m_rootNodeName(rootNodeName)
{
	initXML();
}

void AbstractResultDocument::initXML()
{
	assert(!m_rootNodeName.empty());
	m_root = append_child(m_rootNodeName.c_str());
}

void AbstractResultDocument::addError(const string& msg, const string& elementID)
{
	auto errorNode = m_root.append_child(RES_ERROR);
	errorNode.append_attribute(ELEMENT_ID).set_value(elementID.c_str());
	errorNode.append_child(node_pcdata).set_value(msg.c_str());
	errorNode.append_attribute(ISSUE_ID).set_value(++m_errors);
}

void AbstractResultDocument::addWarning(const string& msg, const string& elementID)
{
	auto warningNode = m_root.append_child(RES_WARNING);
	warningNode.append_attribute(ELEMENT_ID).set_value(elementID.c_str());
	warningNode.append_child(node_pcdata).set_value(msg.c_str());
	warningNode.append_attribute(ISSUE_ID).set_value(++m_warnings);
}

void AbstractResultDocument::setModelId(const string& modelID)
{
	m_root.append_attribute(MODELID).set_value(modelID.c_str());
}

void AbstractResultDocument::setTimeStamp(const int& timeStamp)
{
	m_root.append_attribute(TIMESTAMP).set_value(timeStamp);
}

bool AbstractResultDocument::save(const string& fileName)
{
	m_bSaved = xml_document::save_file(fileName.c_str());
	return m_bSaved;
}
