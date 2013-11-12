#include "InstanceAnalysisTask.h"
#include "AlphaCutAnalysisTask.h"
#include "FuzzTreeTransform.h"

#include <string>
#include <iostream>
#include <fstream>

#include "CommandLineParser.h"
#include "util.h"
#include "xmlutil.h"
#include "analysisResult.h"

int main(int argc, char** argv)
{
	CommandLineParser parser;
	parser.parseCommandline(argc, argv);
	const auto inFile = parser.getInputFilePath().generic_string();
	const auto outFile = parser.getOutputFilePath().generic_string();
	const auto logFile = parser.getLogFilePath().generic_string();

	std::ofstream* logFileStream = new std::ofstream(logFile);
	*logFileStream << "Analysis errors for " << inFile << std::endl;
	if (!logFileStream->good())
	{// create default log file
		logFileStream = new std::ofstream(
			parser.getWorkingDirectory().generic_string() +
			util::slash +
			"errors.txt");	
	}

	try
	{
		std::ifstream instream(inFile);
		if (!instream.good())
		{
			*logFileStream << "Invalid input file: " << inFile << std::endl;
			return -1;
		}

		analysisResults::AnalysisResults analysisResults;

		FuzzTreeTransform tf(instream, *logFileStream);
		if (!tf.isValid())
		{ // handle faulttree
			throw "todo";
		}
		else
		{ // handle fuzztree
			unsigned int decompositionNumber = DEFAULT_DECOMPOSITION_NUMBER;
			
			const auto tree = tf.getFuzzTree();
			const auto modelId = tree->id();
			if (tree->topEvent().decompositionNumber().present())
				decompositionNumber = tree->topEvent().decompositionNumber().get();

			for (const auto& t : tf.transform())
			{
				auto topEvent = fuzztree::TopEvent(t.second.topEvent());
				InstanceAnalysisTask* analysis = new InstanceAnalysisTask(&topEvent, decompositionNumber, *logFileStream);
				const auto result = analysis->compute();

				analysisResults::Result r(modelId, util::timeStamp(), true, decompositionNumber);
				r.configuration(serializedConfiguration(t.first));
				r.probability(serialize(result));
				analysisResults.result().push_back(r);
			}
		}

		std::ofstream output(outFile);
		analysisResults::analysisResults(output, analysisResults);
	}
	catch (const std::exception& e)
	{
		*logFileStream << "Exception while trying to analyze " << inFile << e.what() << std::endl;
		return -1;
	}
	catch (...)
	{
		*logFileStream << "Exception while trying to analyze " << inFile << std::endl;
		return -1;
	}
	
	logFileStream->close();
	delete logFileStream;

	return 0;
}
