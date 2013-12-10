#include "FaultTreeIncludes.h"

#include <gtest/gtest.h>
#include <boost/range/counting_range.hpp>
#include "util.h"

using std::make_shared;

TEST(Tree, BasicTest)
{
	TopLevelEvent faultTree("0");
	FaultTreeNode::Ptr ag = make_shared<ANDGate>("1");
	faultTree.addChild(ag);
	ag->addChild(make_shared<BasicEvent>("2", 0.0001));

	EXPECT_EQ(faultTree.getNumChildren(), 1);
	EXPECT_EQ(ag->getNumChildren(), 1);
}

TEST(Tree, UniqueID)
{
	TopLevelEvent faultTree("0");
	FaultTreeNode::Ptr ag = make_shared<ANDGate>("2");
	faultTree.addChild(ag);

	auto range = boost::counting_range(1, 5);
	for (int i: range)
	{
		ag->addChild(make_shared<BasicEvent>(util::toString(i), 0.0001));
	}

	auto it = faultTree.getChildrenBegin();
	std::set<string> ids;
	while (it != faultTree.getChildrenEnd())
	{
		EXPECT_FALSE(CONTAINS(ids, (*it)->getId()));
		ids.insert((*it)->getId());
		++it;
	}
}

TEST(Tree, CloneTest)
{
	TopLevelEvent faultTree("0");
	FaultTreeNode::Ptr ag = make_shared<ANDGate>("1");
	faultTree.addChild(ag);

	for (int i: boost::counting_range(1, 5))
	{
		ag->addChild(make_shared<BasicEvent>(util::toString(i), 0.0001));
	}

	FaultTreeNode::Ptr clone = faultTree.clone();

	EXPECT_EQ(clone->getNumChildren(), 1);
	FaultTreeNode::Ptr andGate = clone->getChildById("1");
	EXPECT_TRUE(dynamic_pointer_cast<ANDGate>(andGate) != nullptr);

	EXPECT_EQ(andGate->getNumChildren(), 4);
	for (auto it = andGate->getChildrenBegin(); it != andGate->getChildrenEnd(); ++it)
	{
		FaultTreeNode::Ptr tmp = *it;
		EXPECT_TRUE(dynamic_pointer_cast<BasicEvent>(tmp) != nullptr);
	}
}

TEST(Tree, Parents)
{
	TopLevelEvent faultTree("0");
	FaultTreeNode::Ptr ag = make_shared<ANDGate>("1");
	faultTree.addChild(ag);

	EXPECT_TRUE(ag->getParent() != nullptr);
	EXPECT_EQ(ag->getParent(), &faultTree);

	FaultTreeNode::Ptr child = make_shared<BasicEvent>("2" ,0.0001);
	ag->addChild(child);

	EXPECT_EQ(child->getParent()->getId(), "1");
}