#include "FuzzTreeTransform.h"
#include "Constants.h"
#include "FuzzTreeConfiguration.h"

#pragma once
#if IS_WINDOWS 
#pragma warning(push, 3) 
#endif
#include <boost/filesystem/operations.hpp>
#include <boost/range/counting_range.hpp>
#include <exception>
#include <iostream>
#include "ExpressionParser.h"
#if IS_WINDOWS 
#pragma warning(pop) 
#endif
#include "util.h"

#include <omp.h>

using namespace pugi;
using namespace std;
using namespace fuzzTree;
using namespace boost;

void FuzzTreeTransform::transformFuzzTree(const string& fileName, const string& targetDir)
{
	try
	{
		FuzzTreeTransform transform(fileName, targetDir);
		if (!transform.validateAndLoad())
		{
			cout << "Could not load FuzzTree" << endl;
			return;
		}
		
		vector<FuzzTreeConfiguration> configs;
		transform.generateConfigurations(configs);
		
		for (const auto& instanceConfiguration : configs)
		{
			boost::function<void()> generationTask = boost::bind(
				&FuzzTreeTransform::generateFaultTree, &transform, instanceConfiguration);
			
			transform.scheduleFTGeneration(generationTask);
		}
	}
	catch (std::exception& e)
	{
		cout << "Error during FuzzTree Transformation: " << e.what() << endl;
	}
	catch (...)
	{
		cout << "Unknown Error during FuzzTree Transformation" << endl;
	}
}

FuzzTreeTransform::FuzzTreeTransform(const string& fileName, const string& targetDir)
	: XMLImport(fileName), 
	m_targetDir(targetDir), 
	m_count(0)
{
	if (!filesystem::is_directory(targetDir))
	{
		m_targetDir = filesystem::path(fileName);
		m_targetDir.remove_filename();

		cout << "Directory " << targetDir << " not found, defaulting to " << m_targetDir.generic_string() << endl;

		if (!filesystem::is_directory(m_targetDir))
			throw runtime_error("Could not find target directory");
	}
	
	if (!filesystem::is_regular_file(fileName))
	{
		throw runtime_error("File not found " + fileName);
	}

	m_threadPool = threadpool::fifo_pool(omp_get_max_threads()-1);
}

FuzzTreeTransform::~FuzzTreeTransform()
{
	m_threadPool.wait();
	m_threadPool.clear();
}

bool FuzzTreeTransform::loadRootNode()
{
	m_rootNode = m_document.child(FUZZ_TREE);
	if (!m_rootNode)
	{
		throw runtime_error("Missing FuzzTree Root Node");
	}
	return true;
}

void FuzzTreeTransform::shallowCopy(const xml_node& proto, xml_node& copiedNode)
{
	copiedNode.set_name(proto.name());
	copiedNode.set_value(proto.value());

	for (auto attr = proto.attributes_begin(); attr != proto.attributes_end(); ++attr)
	{
		copiedNode.append_attribute(attr->name()).set_value(attr->value());
	}
}

bool FuzzTreeTransform::isFaultTreeGate(const string& typeDescriptor)
{
	return
		typeDescriptor == AND_GATE ||
		typeDescriptor == OR_GATE ||
		typeDescriptor == VOTING_OR_GATE;// TODO dynamic gates
}

/************************************************************************/
/* Traverse the FuzzTree and generate Configurations from it            */
/************************************************************************/

void FuzzTreeTransform::generateConfigurations(vector<FuzzTreeConfiguration>& configs)
{
	xml_node topEventNode = m_rootNode.child(TOP_EVENT);
	assert(!topEventNode.empty());

	configs.emplace_back(FuzzTreeConfiguration()); // default
	generateConfigurationsRecursive(topEventNode, configs);
}

void FuzzTreeTransform::generateConfigurationsRecursive(
	const xml_node& fuzzTreeNode, 
	vector<FuzzTreeConfiguration>& configurations)
{
	for (auto child : fuzzTreeNode.children("children"))
	{
		const string typeDescriptor = child.attribute("xsi:type").as_string();

		const int id		= child.attribute("id").as_int(-1);
		const bool opt		= child.attribute(OPTIONAL_ATTRIBUTE).as_bool(false);

		if (id < 0)
			continue;

		if (opt)
		{
			vector<FuzzTreeConfiguration> additional;
			for (FuzzTreeConfiguration& config : configurations)
			{
				FuzzTreeConfiguration copied = config;
				copied.setNodeOptional(id, true);
				config.setNodeOptional(id, false);

				additional.emplace_back(copied);
			}
			configurations.insert(configurations.begin(), additional.begin(), additional.end());
		}

		if (typeDescriptor == REDUNDANCY_VP)
		{
			const int from = child.attribute("start").as_int(-1);
			const int to = child.attribute("end").as_int(-1);
			if (from < 0 || to < 0 || from > to)
				throw runtime_error("Invalid boundaries for RedundancyGate");

			const std::string formulaString = child.attribute("formula").as_string();
			ExpressionParser<int> parser;
			const std::function<int(int)> formula = [&](int n) -> int
			{
				std::string fomulaStringTmp = formulaString;
				util::replaceStringInPlace(fomulaStringTmp, "N", util::toString(n));
				return parser.eval(fomulaStringTmp);
			};

			vector<FuzzTreeConfiguration> additional;
			for (int i : boost::counting_range(from, to+1))
			{
				int numVotes = formula(i);
				if (numVotes < from || numVotes > to)
					continue;

				for (FuzzTreeConfiguration& config : configurations)
				{
					FuzzTreeConfiguration copied = config;
					copied.setRedundancyNumber(id, numVotes);
					additional.emplace_back(copied);
				}
			}
			configurations.insert(configurations.begin(), additional.begin(), additional.end());
		}
		else if (typeDescriptor == FEATURE_VP)
		{
			// TODO
		}
		else if (isLeaf(typeDescriptor))
		{
			// end recursion
			continue;
		}
		generateConfigurationsRecursive(child, configurations);
	}
}

void FuzzTreeTransform::generateFaultTree(const FuzzTreeConfiguration& configuration)
{
	xml_node topEventNode = m_rootNode.child(TOP_EVENT);
	assert(!topEventNode.empty());

	xml_document* newDoc = new xml_document();
	xml_node newTopEvent = newDoc->append_child(TOP_EVENT);
	shallowCopy(topEventNode, newTopEvent);
	
	generateFaultTreeRecursive(newTopEvent, configuration);

	newDoc->save_file(uniqueFileName().c_str());
}

void FuzzTreeTransform::scheduleFTGeneration(boost::function<void()>& task)
{
	m_threadPool.schedule(task);
}

void FuzzTreeTransform::generateFaultTreeRecursive(
	xml_node& fuzzTreeNode, 
	const FuzzTreeConfiguration& configuration)
{
	for (auto child : fuzzTreeNode.children("children"))
	{
		const string typeDescriptor = child.attribute("xsi:type").as_string();

		const int id		= child.attribute("id").as_int(-1);
		const bool opt		= child.attribute(OPTIONAL_ATTRIBUTE).as_bool(false);

		if (id < 0)
			continue;

		if (opt && configuration.isOptionalEnabled(id))
		{
			if (configuration.isOptionalEnabled(id))
				child.remove_attribute("optional");
			else
				continue; // do not add this node
		}

		if (typeDescriptor == REDUNDANCY_VP)
		{
			const int configuredN = configuration.getRedundancyCount(id);
			// TODO handle basic event set below
		}
		else if (typeDescriptor == FEATURE_VP)
		{

		}
		else if (isFaultTreeGate(typeDescriptor))
		{
			fuzzTreeNode.append_copy(child);
		}
		else if (isLeaf(typeDescriptor))
		{
			fuzzTreeNode.append_copy(child);
			continue; // break recursion
		}

		generateFaultTreeRecursive(child, configuration);
	}
}

bool FuzzTreeTransform::isLeaf(const string& typeDescriptor)
{
	return typeDescriptor == BASIC_EVENT || typeDescriptor == UNDEVELOPED_EVENT;
}

const std::string FuzzTreeTransform::uniqueFileName()
{
	return 
		m_targetDir.generic_string() + "\\" +
		m_file.filename().generic_string() + 
		util::toString(m_count++) + ".fuzztree_";
}
