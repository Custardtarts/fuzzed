#include "MinCutAnalysisTask.h"

#include <string>
#include <iostream>
#include <fstream>

#include "FatalException.h"
#include "CommandLineParser.h"
#include "FuzzTreeTransform.h"
#include "util.h"
#include "xmlutil.h"
#include "backendResult.h"
#include "FaultTreeToFuzzTree.h"

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

	std::ifstream instream(inFile);
	if (!instream.good())
	{
		*logFileStream << "Invalid input file: " << inFile << std::endl;
		return -1;
	}

	std::set<Issue> issues; // issues at fuzztree level
	FuzzTreeTransform tf(instream, issues);
	instream.close();

	backendResults::BackendResults mincutResults;
	try
	{	
		if (!tf.isValid())
		{ // handle faulttree
			std::ifstream is(inFile); // TODO: somehow avoid opening another stream here
			const std::auto_ptr<faulttree::FaultTree> faultTree = 
				faulttree::faultTree(inFile, xml_schema::Flags::dont_validate);
			is.close();

			std::vector<Issue> treeIssues;
			const auto modelId = faultTree->id();

			backendResults::MincutResult r(modelId, EMPTY_CONFIG_ID, util::timeStamp(), true);
			try
			{
				const auto topEvent = faultTreeToFuzzTree(faultTree->topEvent(), treeIssues);	
				MinCutAnalysisTask mt(topEvent.get(), *logFileStream);
				for (const auto& res : mt.analyze())
				{
					std::string mincut;
					for (const auto& s : res)
						mincut += s;

					r.nodeid().push_back(mincut);
				}
			}
			catch (const FatalException& e)
			{
				r.issue().push_back(e.getIssue().serialized());
				r.validResult(false);
			}
			for (const auto& i : treeIssues)
				r.issue().push_back(i.serialized());
			
			mincutResults.result().push_back(r);

			if (!r.validResult())
				faulttree::faultTree(*logFileStream, *(faultTree.get()));
		}
		else
		{ // handle fuzztree
			const auto tree = tf.getFuzzTree();
			const auto modelId = tree->id();
			
			const auto topEvent = tree->topEvent();
			for (const auto& t : tf.transform())
			{
				auto topEvent = fuzztree::TopEvent(t.second.topEvent());
				backendResults::MincutResult r(modelId, t.first.getId(), util::timeStamp(), true);
				try
				{
					MinCutAnalysisTask mt(&topEvent, *logFileStream);
					for (const auto& res : mt.analyze())
					{
						std::string mincut;
						bool first = true;
						for (const auto& s : res)
						{
							if (!first) mincut += ",";
							else first = false;
							mincut += s;
						}

						r.nodeid().push_back(mincut);
					}
				}
				catch (const FatalException& e)
				{
					r.issue().push_back(e.getIssue().serialized());
					r.validResult(false);
				}

				mincutResults.configuration().push_back(serializedConfiguration(t.first));
				mincutResults.result().push_back(r);
			}
		}
	}

	catch (const std::exception& e)// This should not happen.
	{
		*logFileStream << "Exception while trying to analyze " << inFile << e.what() << std::endl;
	}
	catch (...)
	{
		*logFileStream << "Exception while trying to analyze " << inFile << std::endl;
	}

	// Log errors
	for (const Issue& issue : issues)
	{
		mincutResults.issue().push_back(issue.serialized());
		*logFileStream << issue.getMessage() << std::endl;
	}

	std::ofstream output(outFile);
	backendResults::backendResults(output, mincutResults);
	
	logFileStream->close();
	delete logFileStream;

	return 0;
}
