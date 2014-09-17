#pragma once
#include <string>
#include <vector>
#include <cassert>
#include <iostream>

// TODO
typedef double Probability;

namespace nodetype
{
    const std::string AND   = "andGate";
    const std::string OR    = "orGate";
    const std::string XOR   = "xorGate";
    const std::string VOTINGOR  = "votingOrGate";
    const std::string SPARE     = "spareGate";
    const std::string PAND      = "pandGate";
    const std::string SEQ       = "seqGate";

    const std::string BASICEVENT    = "basicEvent";
    const std::string TOPEVENT      = "topEvent";
    const std::string HOUSEEVENT    = "houseEvent";

    const std::string INTERMEDIATEEVENT = "intermediateEvent";
    const std::string UNDEVELOPEDEVENT  = "undevelopedEvent";

    const std::string BASICEVENTSET         = "basicEventSet";
    const std::string INTERMEDIATEEVENTSET  = "intermediateEventSet";

    const std::string REDUNDANCYVP  = "redundancyVariation";
    const std::string FEATUREVP     = "featureVariation";
}


class Node
{
public:
    friend class Model;

    typedef std::vector<Node> ChildList;

    Node(const std::string type, const std::string id, const bool isOptional=false, const std::string name="") :
        m_type(type), m_id(id), m_name(name) {};

    void addChild(const Node c) { m_children.emplace_back(c); }
    const ChildList& getChildren() const { return m_children; }

    const std::string& getType() const   { return m_type; }
    const std::string& getId()   const   { return m_id; }
    const std::string& getName() const   { return m_name; }

    const bool& isOptional()        const { return m_isOptional; }
    const unsigned int& getCost()   const { return m_cost; }
    const unsigned int& getQuantity() const { assert(isEventSet()); return m_quantity; }

    /**
     * Utility functions
     */
    bool isEvent() const;
    bool isGate() const;
    bool isLeaf() const;
    bool isVariationPoint() const;
    bool isEventSet() const;

    void setProbability(const Probability p) { assert(m_type == nodetype::BASICEVENT); m_probability = p; }
    const Probability& getProbability() const { assert(m_type == nodetype::BASICEVENT); return m_probability; }

    std::string print() const { return std::string("- ") + m_type + " ID: " + m_id + " " + m_name; };

private:
    ChildList& getChildren() { return m_children; } // Access only by Model

    std::vector<Node> m_children;

    std::string m_id;
    std::string m_name;
    
    std::string m_type;

    bool m_isOptional;

    unsigned int m_cost;

    /**
     * Basic Event members
     */
    Probability m_probability;

    /**
     * Event Set members
     */
    unsigned int m_quantity;
};