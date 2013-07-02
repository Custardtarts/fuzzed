﻿#include "FuzzTreeTransform.h"
#include "FuzzTreeConfiguration.h"
#include "ExpressionParser.h"
#include "TreeHelpers.h"
#include "TransformUtil.h"

#include <xsd/cxx/tree/elements.hxx>
#include <boost/range/counting_range.hpp>

using xercesc::DOMNode;
using xercesc::DOMDocument;

class Dummy : public faulttree::ChildNode
{
public:
	Dummy() : faulttree::ChildNode(0) {}
};

FuzzTreeTransform::FuzzTreeTransform(const std::string& fuzzTreeXML) :
	m_count(0)
{
	static const std::string fuzztreeSchema = FUZZTREEXSD; // Path to schema from CMakeLists.txt
	assert(!fuzztreeSchema.empty());

	xml_schema::Properties props;
	props.schema_location("ft", fuzztreeSchema);

	try
	{
		m_fuzzTree = fuzztree::fuzzTree(fuzzTreeXML.c_str(), xml_schema::Flags::dont_validate);//fuzztree::fuzzTree(fuzzTreeXML.c_str(), 0, props);
		assert(m_fuzzTree.get());
	}
	catch (const xml_schema::Exception& e)
	{
		std::cout << e.what() << std::endl;
	}
}


FuzzTreeTransform::FuzzTreeTransform(std::istream& fuzzTreeXML)
{
	static const std::string fuzztreeSchema = FUZZTREEXSD; // Path to schema from CMakeLists.txt
	assert(!fuzztreeSchema.empty());

// 	xml_schema::Properties props;
// 	props.schema_location("ft", fuzztreeSchema);

	try
	{
		m_fuzzTree = fuzztree::fuzzTree(fuzzTreeXML, xml_schema::Flags::dont_validate);
		assert(m_fuzzTree.get());
	}
	catch (const xml_schema::Exception& e)
	{
		std::cout << e.what() << std::endl;
	}
}

FuzzTreeTransform::~FuzzTreeTransform()
{}

/************************************************************************/
/* Utility methods                                                      */
/************************************************************************/

bool FuzzTreeTransform::isDummy(const faulttree::Node& node)
{
	return dynamic_cast<const Dummy*>(&node) != nullptr;
}

bool FuzzTreeTransform::isGate(const fuzztree::Node& node)
{
	return
		dynamic_cast<const fuzztree::And*>(&node) ||
		dynamic_cast<const fuzztree::Or*>(&node)  ||
		dynamic_cast<const fuzztree::Xor*>(&node) ||
		dynamic_cast<const fuzztree::VotingOr*>(&node);
}

bool FuzzTreeTransform::isLeaf(const fuzztree::Node& node)
{
	return
		dynamic_cast<const fuzztree::BasicEvent*>(&node) ||
		dynamic_cast<const fuzztree::HouseEvent*>(&node)  ||
		dynamic_cast<const fuzztree::UndevelopedEvent*>(&node);
}

bool FuzzTreeTransform::isOptional(const fuzztree::Node& node)
{
	const fuzztree::InclusionVariationPoint* inclusionNode =
		dynamic_cast<const fuzztree::InclusionVariationPoint*>(&node);
	return inclusionNode && inclusionNode->optional();
}


std::string FuzzTreeTransform::generateUniqueId(const std::string& oldId)
{
	return oldId + "." + util::toString(++m_count);
}

/************************************************************************/
/* Generating all possible configurations initially                     */
/************************************************************************/

void FuzzTreeTransform::generateConfigurations(std::vector<FuzzTreeConfiguration>& configurations) const
{
	configurations.emplace_back(FuzzTreeConfiguration()); // default
	generateConfigurationsRecursive(&m_fuzzTree->topEvent(), configurations);
}

void FuzzTreeTransform::generateConfigurationsRecursive(
	const fuzztree::Node* node, std::vector<FuzzTreeConfiguration>& configurations) const
{
	using namespace fuzztree;
	for (const auto& child : node->children())
	{
		const std::string id = child.id();
		
		if (isOptional(child))
		{ // inclusion variation point. Generate n + n configurations.
			vector<FuzzTreeConfiguration> additional;
			for (FuzzTreeConfiguration& config : configurations)
			{
				if (!config.isIncluded(id) || !config.isIncluded(node->id()))
					continue;

				FuzzTreeConfiguration copied = config;
				copied.setNodeOptional(id, true);
				config.setNodeOptional(id, false);
				config.setNotIncluded(id);

				additional.emplace_back(copied);
			}
			configurations.insert(configurations.begin(), additional.begin(), additional.end());
		}

		const RedundancyVariationPoint* redundancyNode = dynamic_cast<const RedundancyVariationPoint*>(&child);
		if (redundancyNode)
		{ // any VotingOR with k in [from, to] and k=n-2. Generate n * #validVotingOrs configurations.
			const int from = redundancyNode->start();
			const int to = redundancyNode->end();
			if (from < 0 || to < 0 || from > to)
				throw runtime_error("Invalid boundaries for RedundancyGate");

			if (from == to) continue;

			const std::string formulaString = redundancyNode->formula();
			ExpressionParser<int> parser;
			const std::function<int(int)> formula = [&](int n) -> int
			{
				std::string fomulaStringTmp = formulaString;
				util::replaceStringInPlace(fomulaStringTmp, "N", util::toString(n));
				return parser.eval(fomulaStringTmp);
			};

			vector<FuzzTreeConfiguration> newConfigs;
			for (FuzzTreeConfiguration& config : configurations)
			{
				if (config.isIncluded(id))
				{
					for (int i : boost::counting_range(from, to+1))
					{
						FuzzTreeConfiguration copied = config;
						const int numVotes = formula(i);
						if (numVotes <= 0)
							continue;
						copied.setRedundancyNumber(id, numVotes, i);
						newConfigs.emplace_back(copied);
					}
				}
				else
					newConfigs.emplace_back(config); // keep config as it is
			}

			if (!newConfigs.empty())
			{
				assert(newConfigs.size() >= configurations.size());
				configurations.assign(newConfigs.begin(), newConfigs.end());
			}
		}
		else
		{
			const FeatureVariationPoint* featureNode = dynamic_cast<const FeatureVariationPoint*>(&child);
			if (featureNode)
			{ // exactly one subtree. Generate N * #Features configurations.
				vector<FuzzTreeConfiguration::id_type> childIds;
				for (const auto& featuredChild : featureNode->children())
					childIds.emplace_back(featuredChild.id());

				if (childIds.empty())
				{
					throw runtime_error("Feature Variation Points need child nodes");
					continue;
				}

				vector<FuzzTreeConfiguration> newConfigs;
				for (FuzzTreeConfiguration& config : configurations)
				{
					if (config.isIncluded(id))
					{
						for (const auto& i : childIds)
						{
							FuzzTreeConfiguration copied = config;
							copied.setFeatureNumber(id, i);
							for (const auto& other : childIds)
								if (other != i) 
									copied.setNotIncluded(other);
							
							newConfigs.emplace_back(copied);
						}
					}
					else
						newConfigs.emplace_back(config); // keep config as it is
				}

				if (!newConfigs.empty())
				{
					assert(newConfigs.size() >= configurations.size());
					configurations.assign(newConfigs.begin(), newConfigs.end());
				}
			}
			else if (isLeaf(child))
			{ // TODO find out if this is necessary, and about the performance of dynamic_cast
				continue; // end recursion
			}
		}
		generateConfigurationsRecursive(&child, configurations);
	}
}

/************************************************************************/
/* Generating fault trees from configurations                           */
/************************************************************************/

faulttree::FaultTree FuzzTreeTransform::generateFaultTree(const FuzzTreeConfiguration& configuration)
{
	const fuzztree::TopEvent topEvent = m_fuzzTree->topEvent();
	auto newTopEvent = treeHelpers::copyTopEvent(topEvent);

	generateFaultTreeRecursive(&topEvent, &newTopEvent, configuration);
	return faulttree::FaultTree(generateUniqueId(topEvent.id()), newTopEvent);
}

void FuzzTreeTransform::generateFaultTreeRecursive(
	const fuzztree::Node* templateNode,
	faulttree::Node* node,
	const FuzzTreeConfiguration& configuration) const
{
	for (const auto& currentChild : templateNode->children())
	{
		const auto id = currentChild.id();
		
		const fuzztree::InclusionVariationPoint* inclusionNode = 
			dynamic_cast<const fuzztree::InclusionVariationPoint*>(&currentChild);
		const bool opt = (inclusionNode != nullptr) && inclusionNode->optional();

		if (!configuration.isIncluded(id) || (opt && !configuration.isOptionalEnabled(id)))
			continue; // do not add this node

		const bool bLeaf = isLeaf(currentChild);
		bool bChanged = false;

		const fuzztree::RedundancyVariationPoint* redundancyNode = 
			dynamic_cast<const fuzztree::RedundancyVariationPoint*>(&currentChild);
		if (redundancyNode)
		{ // TODO: probably this always ends up with a leaf node
			handleRedundancyVP(
				redundancyNode, 
				node, 
				configuration.getRedundancyCount(id), 
				id); // returns a VotingOR Gate

			continue; // stop recursion
		}
		else
		{
			const fuzztree::FeatureVariationPoint* featureNode = 
				dynamic_cast<const fuzztree::FeatureVariationPoint*>(&currentChild);
			if (featureNode)
			{
				if (handleFeatureVP(
					featureNode, 
					node,
					configuration, 
					configuration.getFeaturedChild(id)))
					continue;
			}

			else
			{
				if (isGate(currentChild))
				{ // don't copy children yet
					node->children().push_back(treeHelpers::copyGate(dynamic_cast<const fuzztree::Gate&>(currentChild)));
					bChanged = true;
				}
				else if (bLeaf)
				{ // copy everything including probability child node
					node->children().push_back(treeHelpers::copyBasicEvent(dynamic_cast<const fuzztree::BasicEvent&>(currentChild)));
					bChanged = true;
				}
				else
				{
					const fuzztree::BasicEventSet* basicEventSet = 
						dynamic_cast<const fuzztree::BasicEventSet*>(&currentChild);

					if (basicEventSet)
					{
						expandBasicEventSet(basicEventSet, node, id, 0);
						continue;
					}
				}
			}	
		}		

		// break recursion
		if (bLeaf) continue;

		generateFaultTreeRecursive(&currentChild, bChanged ? &node->children().back() : node, configuration);
	}
}

void FuzzTreeTransform::expandBasicEventSet(
	const fuzztree::Node* templateNode,
	faulttree::Node* parentNode, 
	const FuzzTreeConfiguration::id_type& id,
	const int& defaultQuantity /*= 0*/) const
{
	assert(parentNode && templateNode);

	const fuzztree::BasicEventSet* eventSet = dynamic_cast<const fuzztree::BasicEventSet*>(templateNode);
	assert(eventSet);

	// barharhar
	const int numChildren = 
		defaultQuantity == 0 ? eventSet->quantity().present() ? eventSet->quantity().get() : defaultQuantity : defaultQuantity;

	if (numChildren <= 0)
	{
		throw runtime_error("Invalid Quantity in Basic Event Set");
	}
	
	const faulttree::Probability probability = 
		treeHelpers::copyProbability(eventSet->probability());

	int i = 0;
	while (i < numChildren)
	{
		const auto id = eventSet->id();
		faulttree::BasicEvent basicEvent(id + util::toString(i), probability);
		parentNode->children().push_back(basicEvent);
		i++;
	}
}

bool FuzzTreeTransform::handleFeatureVP(
	const fuzztree::ChildNode* templateNode,
	faulttree::Node* node,
	const FuzzTreeConfiguration& configuration,
	const FuzzTreeConfiguration::id_type& configuredChildId) const
{
	assert(node && templateNode);
	// find the configured child
	auto it = templateNode->children().begin();
	while (it != templateNode->children().end())
	{
		if (it->id() == configuredChildId)
			break;
		++it;
	}
	
	const fuzztree::ChildNode featuredTemplate = *it;
	if (isOptional(featuredTemplate) && !configuration.isIncluded(configuredChildId))
	{
		node->children().push_back(Dummy());
		return true;
	}
	else if (isLeaf(featuredTemplate))
	{
		node->children().push_back(treeHelpers::copyBasicEvent(dynamic_cast<const fuzztree::BasicEvent&>(featuredTemplate)));
		return true;
	}
	else if (dynamic_cast<const fuzztree::BasicEventSet*>(&featuredTemplate))
	{ 
		expandBasicEventSet(&featuredTemplate, node, configuredChildId, 0);
		return true;
	}
	else if (isGate(featuredTemplate))
	{
		node->children().push_back(treeHelpers::copyGate(featuredTemplate));
		return false;
	}
	else
	{
		if (dynamic_cast<const fuzztree::FeatureVariationPoint*>(node) ||
			dynamic_cast<const fuzztree::RedundancyVariationPoint*>(node))
			return false;
	}
	return false;
}

bool FuzzTreeTransform::handleRedundancyVP(
	const fuzztree::ChildNode* templateNode,
	faulttree::Node* node,
	const tuple<int,int> kOutOfN,
	const FuzzTreeConfiguration::id_type& id) const
{
	assert(node && templateNode);

	if (isDummy(*node))
		assert(false && "handle this!");// TODO
	
	const fuzztree::BasicEventSet* basicEventSet = 
		dynamic_cast<const fuzztree::BasicEventSet*>(&templateNode->children().front());
	
	if (basicEventSet)
	{
		faulttree::VotingOr votingOrGate(id, get<0>(kOutOfN));
		expandBasicEventSet(basicEventSet, &votingOrGate, id, get<1>(kOutOfN));
		node->children().push_back(votingOrGate);
		return true;
	}
	else throw runtime_error("Child of Redundancy VP must be an event set");
}

std::vector<faulttree::FaultTree> FuzzTreeTransform::transform()
{
	try
	{
		vector<faulttree::FaultTree> results;
		vector<FuzzTreeConfiguration> configs;
		generateConfigurations(configs);

		int indent = 0;
		treeHelpers::printTree(m_fuzzTree->topEvent(), indent);
		cout << endl << " ...... configurations: ...... " << endl;

		for (const auto& instanceConfiguration : configs)
		{
			auto faultTree = generateFaultTree(instanceConfiguration);	
			indent = 0;
			treeHelpers::printTree(faultTree.topEvent(), indent);
			cout << endl;
			results.emplace_back(faultTree);
		}

		return results;
	}
	catch (xsd::cxx::exception& e)
	{
		cout << "Parse Error: " << e.what() << endl;
	}
	catch (std::exception& e)
	{
		cout << "Error during FuzzTree Transformation: " << e.what() << endl;
	}
	catch (...)
	{
		cout << "Unknown Error during FuzzTree Transformation" << endl;
	}

	return vector<faulttree::FaultTree>();
}
