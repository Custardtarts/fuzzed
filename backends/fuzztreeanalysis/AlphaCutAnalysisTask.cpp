#include "AlphaCutAnalysisTask.h"
#include "FuzzTreeTypes.h"
#include "Probability.h"
#include "Interval.h"
#include "xmlutil.h"
#include "FatalException.h"

#include <math.h>
#include <algorithm>
#include <bitset>
#include <climits>
#include <exception>

using namespace fuzztree;
using std::vector;
using std::string;

namespace
{
	static const std::string UNDEVELOPED_ERROR	= "The tree contains undeveloped events and cannot be analyzed.";
	static const std::string UNKNOWN_TYPE		= "Unknown child node type.";
}


AlphaCutAnalysisTask::AlphaCutAnalysisTask(const TopEvent* topEvent, const double alpha, std::ofstream& logfile)
: m_tree(topEvent), m_alpha(alpha), m_logFile(logfile), m_bDetectedUndeveloped(false)
{}

std::future<AlphaCutAnalysisResult> AlphaCutAnalysisTask::run()
{
	return std::async(std::launch::async, &AlphaCutAnalysisTask::analyze, this);
}

AlphaCutAnalysisResult AlphaCutAnalysisTask::analyze()
{
	if (m_tree->children().size() == 0)
		return NumericInterval(1.0, 1.0); // trees without children are completely reliable
	return analyzeRecursive(m_tree->children().front());
}

AlphaCutAnalysisResult AlphaCutAnalysisTask::analyzeRecursive(const fuzztree::ChildNode& node)
{
	using namespace fuzztreeType;
	const type_info& typeName = typeid(node);
	
	// Leaf nodes...
	if (typeName == *BASICEVENT) 
	{
		const auto& prob = (static_cast<const fuzztree::BasicEvent&>(node)).probability();
		const type_info& probType = typeid(prob);

		if (probType == *CRISPPROB)
		{
			return probability::getAlphaCutBounds(static_cast<const fuzztree::CrispProbability&>(prob));
		}
		else if (probType == *DECOMPOSEDFUZZYINTERVAL)
		{
			return probability::getAlphaCutBounds(parse(static_cast<const fuzztree::DecomposedFuzzyProbability&>(prob)), m_alpha);
		}
		else if (probType == *TRIANGULARFUZZYINTERVAL)
		{
			return probability::getAlphaCutBounds(static_cast<const fuzztree::TriangularFuzzyInterval&>(prob), m_alpha);
		}
		else if (probType == *FAILURERATE)
		{
			const unsigned int mt = m_tree->missionTime().present() ?  
				m_tree->missionTime().get() : DEFAULT_MISSION_TIME;
			
			return probability::getAlphaCutBounds(static_cast<const fuzztree::FailureRate&>(prob), mt);
		}
		else
		{
			const string error = string("Unexpected probability type: ") + probType.name();
			m_logFile << error << std::endl;
			
			throw FatalException(error, 0, node.id());
		}
	}
	else if (typeName == *BASICEVENTSET || typeName == *INTERMEDIATEEVENTSET)
	{
		// the java code handled this, so the event sets were not expanded by the configuration
		// the C++ configuration code already expands event sets

		const string error = string("Unexpected Event Set (they should have been removed by configuration): ") + typeName.name();
		m_logFile << error << std::endl;
		
		throw FatalException(error, 0, node.id());
	}
	else if (typeName == *HOUSEEVENT)
	{
		// TODO: new House Variation Point?
		return NumericInterval(1.0, 1.0);
	}
	else if (typeName == *UNDEVELOPEDEVENT)
	{
		m_logFile << "Found Undeveloped Event, ID: " << node.id() << std::endl;
		if (m_bDetectedUndeveloped)
			return NumericInterval(); // this error was already reported once
		
		m_bDetectedUndeveloped = true;
		
		throw FatalException(UNDEVELOPED_ERROR, 0);
	}
	else if (typeName == *INTERMEDIATEEVENT)
	{
		if (node.children().size() != 1)
		{
			m_logFile << "Intermediate Event size != 1, ID: , size: " << node.id() << std::endl;
			if (node.children().size() == 0)
				return NumericInterval(1.0, 1.0);
		}
		return analyzeRecursive(node.children().front());
	}
	
	// Static Gates...
	else if (typeName == *AND)
	{
		interval_t lowerBound = 1.0;
		interval_t upperBound = 1.0;
		for (const auto& c : node.children())
		{
			const auto res = analyzeRecursive(c);

			lowerBound *= res.lowerBound;
			upperBound *= res.upperBound;
		}
		return NumericInterval(lowerBound, upperBound);
	}
	else if (typeName == *OR)
	{
		interval_t lowerBound = 0.0;
		interval_t upperBound = 0.0;

		for (const auto& c : node.children())
		{
			const auto res = analyzeRecursive(c);

			lowerBound += res.lowerBound - (lowerBound * res.lowerBound);
			upperBound += res.upperBound - (upperBound * res.upperBound);
		}

		return NumericInterval(lowerBound, upperBound);
	}
	else if (typeName == *XOR)
	{
		// Calculate results of children first.
		const unsigned int n = node.children().size();

		vector<interval_t> lowerBounds;
		vector<interval_t> upperBounds;
		for (const auto& c : node.children())
		{
			const auto res = analyzeRecursive(c);
			/*
			 * ATTENTION: Here the values are negated since this is more efficient
			 * (there are much more negated terms than not-negated).
			 */
			lowerBounds.emplace_back(1 - res.lowerBound);
			upperBounds.emplace_back(1 - res.upperBound);
		}
		
		// Get all permutations of lower and upper bounds (idea see VotingOr gate).
		const unsigned int numberOfCombinations = (int)std::pow(2, n);
		vector<interval_t> combinations(numberOfCombinations);
		for (unsigned int i = 0; i < numberOfCombinations; ++i)
		{
			vector<interval_t> perm;
			for (unsigned int j = 0; j < n; j++)
				perm.emplace_back((i >> j)&1 ? upperBounds[j] : lowerBounds[j]);

			combinations[i] = calculateExactlyOneOutOfN(perm, n);
		}

		return NumericInterval(
			*std::min_element(combinations.begin(), combinations.end()),
			*std::max_element(combinations.begin(), combinations.end()));
	}
	else if (typeName == *VOTINGOR)
	{
		const auto votingOr = static_cast<const fuzztree::VotingOr&>(node);
		
		const int k = votingOr.k();
		const int n = votingOr.children().size();

		vector<interval_t> lowerBounds;
		vector<interval_t> upperBounds;

		for (const auto& c : node.children())
		{
			const auto res = analyzeRecursive(c);
			lowerBounds.emplace_back(res.lowerBound);
			upperBounds.emplace_back(res.upperBound);
		}

		return NumericInterval(
			calculateKOutOfN(lowerBounds, k, n),
			calculateKOutOfN(upperBounds, k, n));
	}
	else
	{
		throw FatalException(UNKNOWN_TYPE);
	}


	return NumericInterval();
}

double AlphaCutAnalysisTask::calculateExactlyOneOutOfN(const vector<interval_t>& values, unsigned int n)
{
	interval_t result = 0.0;
	for (unsigned int i = 0; i < n; i++)
	{
		interval_t termResult = 1.0;
		for (unsigned int j = 0; j < n; j++)
		{
			// un-negate the ith value 
			termResult *= (i == j) ? (1 - values[j]) :  values[j];
		}
		result += termResult;
	}
	return result;
}

double AlphaCutAnalysisTask::calculateKOutOfN(const vector<interval_t>& values, unsigned int k, unsigned int n)
{
	assert(values.size() == n);
	
	vector<double> p;
	p.emplace_back(1.0);

	for (unsigned int i = 1; i <= k; i++)
		p.emplace_back(0.0);

	for (unsigned int i = 0; i < n; i++)
		for (unsigned int j = k; j >= 1; j--)
			p[j] = values[i] * p[j-1] + (1-values[i]) * p[j];

	return p[k];
}

AlphaCutAnalysisTask::~AlphaCutAnalysisTask()
{
	;
}