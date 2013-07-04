#pragma once

namespace faultTreeType
{
	const std::string AND		= "class faulttree::And";
	const std::string OR		= "class faulttree::Or";
	const std::string XOR		= "class faulttree::Xor";
	const std::string VOTINGOR	= "class faulttree::VotingOr";

	const std::string CRISPPROB	= "class faulttree::CrispProbability";

	const std::string BASICEVENT		= "class faulttree::BasicEvent";
	const std::string INTERMEDIATEEVENT	= "class faulttree::IntermediateEvent";
	const std::string HOUSEEVENT		= "class faulttree::HouseEvent";
	const std::string UNDEVELOPEDEVENT	= "class faulttree::UndevelopedEvent";

	const std::string FDEP	= "class faulttree::FDEP";
	const std::string SPARE = "class faulttree::ColdSpare";
	const std::string PAND	= "class faulttree::PAND";
}