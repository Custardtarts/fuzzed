// Copyright (c) 2005-2014 Code Synthesis Tools CC
//
// This program was generated by CodeSynthesis XSD, an XML Schema to
// C++ data binding compiler.
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License version 2 as
// published by the Free Software Foundation.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
//
// In addition, as a special exception, Code Synthesis Tools CC gives
// permission to link this program with the Xerces-C++ library (or with
// modified versions of Xerces-C++ that use the same license as Xerces-C++),
// and distribute linked combinations including the two. You must obey
// the GNU General Public License version 2 in all respects for all of
// the code used other than Xerces-C++. If you modify this copy of the
// program, you may extend this exception to your version of the program,
// but you are not obligated to do so. If you do not wish to do so, delete
// this exception statement from your version.
//
// Furthermore, Code Synthesis Tools CC makes a special exception for
// the Free/Libre and Open Source Software (FLOSS) which is described
// in the accompanying FLOSSE file.
//

#ifndef CXX_ORE_BACK____FRONT_FUZZ_ED_STATIC_XSD_BACKEND_H
#define CXX_ORE_BACK____FRONT_FUZZ_ED_STATIC_XSD_BACKEND_H

#ifndef XSD_USE_CHAR
#define XSD_USE_CHAR
#endif

#ifndef XSD_CXX_TREE_USE_CHAR
#define XSD_CXX_TREE_USE_CHAR
#endif

// Begin prologue.
//
//
// End prologue.

#include <xsd/cxx/config.hxx>

#if (XSD_INT_VERSION != 4000000L)
#error XSD runtime version mismatch
#endif

#include <xsd/cxx/pre.hxx>

#include <xsd/cxx/xml/char-utf8.hxx>

#include <xsd/cxx/tree/exceptions.hxx>
#include <xsd/cxx/tree/elements.hxx>
#include <xsd/cxx/tree/types.hxx>

#include <xsd/cxx/xml/error-handler.hxx>

#include <xsd/cxx/xml/dom/auto-ptr.hxx>

#include <xsd/cxx/tree/parsing.hxx>
#include <xsd/cxx/tree/parsing/byte.hxx>
#include <xsd/cxx/tree/parsing/unsigned-byte.hxx>
#include <xsd/cxx/tree/parsing/short.hxx>
#include <xsd/cxx/tree/parsing/unsigned-short.hxx>
#include <xsd/cxx/tree/parsing/int.hxx>
#include <xsd/cxx/tree/parsing/unsigned-int.hxx>
#include <xsd/cxx/tree/parsing/long.hxx>
#include <xsd/cxx/tree/parsing/unsigned-long.hxx>
#include <xsd/cxx/tree/parsing/boolean.hxx>
#include <xsd/cxx/tree/parsing/float.hxx>
#include <xsd/cxx/tree/parsing/double.hxx>
#include <xsd/cxx/tree/parsing/decimal.hxx>

#include <xsd/cxx/xml/dom/serialization-header.hxx>
#include <xsd/cxx/tree/serialization.hxx>
#include <xsd/cxx/tree/serialization/byte.hxx>
#include <xsd/cxx/tree/serialization/unsigned-byte.hxx>
#include <xsd/cxx/tree/serialization/short.hxx>
#include <xsd/cxx/tree/serialization/unsigned-short.hxx>
#include <xsd/cxx/tree/serialization/int.hxx>
#include <xsd/cxx/tree/serialization/unsigned-int.hxx>
#include <xsd/cxx/tree/serialization/long.hxx>
#include <xsd/cxx/tree/serialization/unsigned-long.hxx>
#include <xsd/cxx/tree/serialization/boolean.hxx>
#include <xsd/cxx/tree/serialization/float.hxx>
#include <xsd/cxx/tree/serialization/double.hxx>
#include <xsd/cxx/tree/serialization/decimal.hxx>

namespace xml_schema
{
  // anyType and anySimpleType.
  //
  typedef ::xsd::cxx::tree::type Type;
  typedef ::xsd::cxx::tree::simple_type< char, Type > SimpleType;
  typedef ::xsd::cxx::tree::type Container;

  // 8-bit
  //
  typedef signed char Byte;
  typedef unsigned char UnsignedByte;

  // 16-bit
  //
  typedef short Short;
  typedef unsigned short UnsignedShort;

  // 32-bit
  //
  typedef int Int;
  typedef unsigned int UnsignedInt;

  // 64-bit
  //
  typedef long long Long;
  typedef unsigned long long UnsignedLong;

  // Supposed to be arbitrary-length integral types.
  //
  typedef long long Integer;
  typedef long long NonPositiveInteger;
  typedef unsigned long long NonNegativeInteger;
  typedef unsigned long long PositiveInteger;
  typedef long long NegativeInteger;

  // Boolean.
  //
  typedef bool Boolean;

  // Floating-point types.
  //
  typedef float Float;
  typedef double Double;
  typedef double Decimal;

  // String types.
  //
  typedef ::xsd::cxx::tree::string< char, SimpleType > String;
  typedef ::xsd::cxx::tree::normalized_string< char, String > NormalizedString;
  typedef ::xsd::cxx::tree::token< char, NormalizedString > Token;
  typedef ::xsd::cxx::tree::name< char, Token > Name;
  typedef ::xsd::cxx::tree::nmtoken< char, Token > Nmtoken;
  typedef ::xsd::cxx::tree::nmtokens< char, SimpleType, Nmtoken > Nmtokens;
  typedef ::xsd::cxx::tree::ncname< char, Name > Ncname;
  typedef ::xsd::cxx::tree::language< char, Token > Language;

  // ID/IDREF.
  //
  typedef ::xsd::cxx::tree::id< char, Ncname > Id;
  typedef ::xsd::cxx::tree::idref< char, Ncname, Type > Idref;
  typedef ::xsd::cxx::tree::idrefs< char, SimpleType, Idref > Idrefs;

  // URI.
  //
  typedef ::xsd::cxx::tree::uri< char, SimpleType > Uri;

  // Qualified name.
  //
  typedef ::xsd::cxx::tree::qname< char, SimpleType, Uri, Ncname > Qname;

  // Binary.
  //
  typedef ::xsd::cxx::tree::buffer< char > Buffer;
  typedef ::xsd::cxx::tree::base64_binary< char, SimpleType > Base64Binary;
  typedef ::xsd::cxx::tree::hex_binary< char, SimpleType > HexBinary;

  // Date/time.
  //
  typedef ::xsd::cxx::tree::time_zone TimeZone;
  typedef ::xsd::cxx::tree::date< char, SimpleType > Date;
  typedef ::xsd::cxx::tree::date_time< char, SimpleType > DateTime;
  typedef ::xsd::cxx::tree::duration< char, SimpleType > Duration;
  typedef ::xsd::cxx::tree::gday< char, SimpleType > Gday;
  typedef ::xsd::cxx::tree::gmonth< char, SimpleType > Gmonth;
  typedef ::xsd::cxx::tree::gmonth_day< char, SimpleType > GmonthDay;
  typedef ::xsd::cxx::tree::gyear< char, SimpleType > Gyear;
  typedef ::xsd::cxx::tree::gyear_month< char, SimpleType > GyearMonth;
  typedef ::xsd::cxx::tree::time< char, SimpleType > Time;

  // Entity.
  //
  typedef ::xsd::cxx::tree::entity< char, Ncname > Entity;
  typedef ::xsd::cxx::tree::entities< char, SimpleType, Entity > Entities;

  typedef ::xsd::cxx::tree::content_order ContentOrder;
  // Namespace information and list stream. Used in
  // serialization functions.
  //
  typedef ::xsd::cxx::xml::dom::namespace_info< char > NamespaceInfo;
  typedef ::xsd::cxx::xml::dom::namespace_infomap< char > NamespaceInfomap;
  typedef ::xsd::cxx::tree::list_stream< char > ListStream;
  typedef ::xsd::cxx::tree::as_double< Double > AsDouble;
  typedef ::xsd::cxx::tree::as_decimal< Decimal > AsDecimal;
  typedef ::xsd::cxx::tree::facet Facet;

  // Flags and properties.
  //
  typedef ::xsd::cxx::tree::flags Flags;
  typedef ::xsd::cxx::tree::properties< char > Properties;

  // Parsing/serialization diagnostics.
  //
  typedef ::xsd::cxx::tree::severity Severity;
  typedef ::xsd::cxx::tree::error< char > Error;
  typedef ::xsd::cxx::tree::diagnostics< char > Diagnostics;

  // Exceptions.
  //
  typedef ::xsd::cxx::tree::exception< char > Exception;
  typedef ::xsd::cxx::tree::bounds< char > Bounds;
  typedef ::xsd::cxx::tree::duplicate_id< char > DuplicateId;
  typedef ::xsd::cxx::tree::parsing< char > Parsing;
  typedef ::xsd::cxx::tree::expected_element< char > ExpectedElement;
  typedef ::xsd::cxx::tree::unexpected_element< char > UnexpectedElement;
  typedef ::xsd::cxx::tree::expected_attribute< char > ExpectedAttribute;
  typedef ::xsd::cxx::tree::unexpected_enumerator< char > UnexpectedEnumerator;
  typedef ::xsd::cxx::tree::expected_text_content< char > ExpectedTextContent;
  typedef ::xsd::cxx::tree::no_prefix_mapping< char > NoPrefixMapping;
  typedef ::xsd::cxx::tree::no_type_info< char > NoTypeInfo;
  typedef ::xsd::cxx::tree::not_derived< char > NotDerived;
  typedef ::xsd::cxx::tree::serialization< char > Serialization;

  // Error handler callback interface.
  //
  typedef ::xsd::cxx::xml::error_handler< char > ErrorHandler;

  // DOM interaction.
  //
  namespace dom
  {
    // Automatic pointer for DOMDocument.
    //
    using ::xsd::cxx::xml::dom::auto_ptr;

#ifndef XSD_CXX_TREE_TREE_NODE_KEY__XML_SCHEMA
#define XSD_CXX_TREE_TREE_NODE_KEY__XML_SCHEMA
    // DOM user data key for back pointers to tree nodes.
    //
    const XMLCh* const treeNodeKey = ::xsd::cxx::tree::user_data_keys::node;
#endif
  }
}

// Forward declarations.
//
namespace backendResults
{
  class Result;
  class MincutResult;
  class SimulationResult;
  class AnalysisResult;
  class BackendResults;
}


#include <memory>    // ::std::auto_ptr
#include <limits>    // std::numeric_limits
#include <algorithm> // std::binary_search

#include <xsd/cxx/xml/char-utf8.hxx>

#include <xsd/cxx/tree/exceptions.hxx>
#include <xsd/cxx/tree/elements.hxx>
#include <xsd/cxx/tree/containers.hxx>
#include <xsd/cxx/tree/list.hxx>

#include <xsd/cxx/xml/dom/parsing-header.hxx>

#include <common.h>

#include <configurations.h>

namespace backendResults
{
  class Result: public ::xml_schema::Type
  {
    public:
    // issue
    //
    typedef ::commonTypes::Issue IssueType;
    typedef ::xsd::cxx::tree::sequence< IssueType > IssueSequence;
    typedef IssueSequence::iterator IssueIterator;
    typedef IssueSequence::const_iterator IssueConstIterator;
    typedef ::xsd::cxx::tree::traits< IssueType, char > IssueTraits;

    const IssueSequence&
    issue () const;

    IssueSequence&
    issue ();

    void
    issue (const IssueSequence& s);

    // id
    //
    typedef ::xml_schema::String IdType;
    typedef ::xsd::cxx::tree::optional< IdType > IdOptional;
    typedef ::xsd::cxx::tree::traits< IdType, char > IdTraits;

    const IdOptional&
    id () const;

    IdOptional&
    id ();

    void
    id (const IdType& x);

    void
    id (const IdOptional& x);

    void
    id (::std::auto_ptr< IdType > p);

    // modelId
    //
    typedef ::xml_schema::String ModelIdType;
    typedef ::xsd::cxx::tree::traits< ModelIdType, char > ModelIdTraits;

    const ModelIdType&
    modelId () const;

    ModelIdType&
    modelId ();

    void
    modelId (const ModelIdType& x);

    void
    modelId (::std::auto_ptr< ModelIdType > p);

    // configId
    //
    typedef ::xml_schema::String ConfigIdType;
    typedef ::xsd::cxx::tree::traits< ConfigIdType, char > ConfigIdTraits;

    const ConfigIdType&
    configId () const;

    ConfigIdType&
    configId ();

    void
    configId (const ConfigIdType& x);

    void
    configId (::std::auto_ptr< ConfigIdType > p);

    // timestamp
    //
    typedef ::xml_schema::String TimestampType;
    typedef ::xsd::cxx::tree::traits< TimestampType, char > TimestampTraits;

    const TimestampType&
    timestamp () const;

    TimestampType&
    timestamp ();

    void
    timestamp (const TimestampType& x);

    void
    timestamp (::std::auto_ptr< TimestampType > p);

    // validResult
    //
    typedef ::xml_schema::Boolean ValidResultType;
    typedef ::xsd::cxx::tree::traits< ValidResultType, char > ValidResultTraits;

    const ValidResultType&
    validResult () const;

    ValidResultType&
    validResult ();

    void
    validResult (const ValidResultType& x);

    // Constructors.
    //
    Result (const ModelIdType&,
            const ConfigIdType&,
            const TimestampType&,
            const ValidResultType&);

    Result (const ::xercesc::DOMElement& e,
            ::xml_schema::Flags f = 0,
            ::xml_schema::Container* c = 0);

    Result (const Result& x,
            ::xml_schema::Flags f = 0,
            ::xml_schema::Container* c = 0);

    virtual Result*
    _clone (::xml_schema::Flags f = 0,
            ::xml_schema::Container* c = 0) const;

    Result&
    operator= (const Result& x);

    virtual 
    ~Result ();

    // Implementation.
    //
    protected:
    void
    parse (::xsd::cxx::xml::dom::parser< char >&,
           ::xml_schema::Flags);

    protected:
    IssueSequence issue_;
    IdOptional id_;
    ::xsd::cxx::tree::one< ModelIdType > modelId_;
    ::xsd::cxx::tree::one< ConfigIdType > configId_;
    ::xsd::cxx::tree::one< TimestampType > timestamp_;
    ::xsd::cxx::tree::one< ValidResultType > validResult_;
  };

  class MincutResult: public ::backendResults::Result
  {
    public:
    // nodeid
    //
    typedef ::xml_schema::String NodeidType;
    typedef ::xsd::cxx::tree::sequence< NodeidType > NodeidSequence;
    typedef NodeidSequence::iterator NodeidIterator;
    typedef NodeidSequence::const_iterator NodeidConstIterator;
    typedef ::xsd::cxx::tree::traits< NodeidType, char > NodeidTraits;

    const NodeidSequence&
    nodeid () const;

    NodeidSequence&
    nodeid ();

    void
    nodeid (const NodeidSequence& s);

    // Constructors.
    //
    MincutResult (const ModelIdType&,
                  const ConfigIdType&,
                  const TimestampType&,
                  const ValidResultType&);

    MincutResult (const ::xercesc::DOMElement& e,
                  ::xml_schema::Flags f = 0,
                  ::xml_schema::Container* c = 0);

    MincutResult (const MincutResult& x,
                  ::xml_schema::Flags f = 0,
                  ::xml_schema::Container* c = 0);

    virtual MincutResult*
    _clone (::xml_schema::Flags f = 0,
            ::xml_schema::Container* c = 0) const;

    MincutResult&
    operator= (const MincutResult& x);

    virtual 
    ~MincutResult ();

    // Implementation.
    //
    protected:
    void
    parse (::xsd::cxx::xml::dom::parser< char >&,
           ::xml_schema::Flags);

    protected:
    NodeidSequence nodeid_;
  };

  class SimulationResult: public ::backendResults::Result
  {
    public:
    // reliability
    //
    typedef ::xml_schema::Double ReliabilityType;
    typedef ::xsd::cxx::tree::traits< ReliabilityType, char, ::xsd::cxx::tree::schema_type::double_ > ReliabilityTraits;

    const ReliabilityType&
    reliability () const;

    ReliabilityType&
    reliability ();

    void
    reliability (const ReliabilityType& x);

    // nFailures
    //
    typedef ::xml_schema::Int NFailuresType;
    typedef ::xsd::cxx::tree::traits< NFailuresType, char > NFailuresTraits;

    const NFailuresType&
    nFailures () const;

    NFailuresType&
    nFailures ();

    void
    nFailures (const NFailuresType& x);

    // nSimulatedRounds
    //
    typedef ::xml_schema::Int NSimulatedRoundsType;
    typedef ::xsd::cxx::tree::traits< NSimulatedRoundsType, char > NSimulatedRoundsTraits;

    const NSimulatedRoundsType&
    nSimulatedRounds () const;

    NSimulatedRoundsType&
    nSimulatedRounds ();

    void
    nSimulatedRounds (const NSimulatedRoundsType& x);

    // availability
    //
    typedef ::xml_schema::Double AvailabilityType;
    typedef ::xsd::cxx::tree::optional< AvailabilityType > AvailabilityOptional;
    typedef ::xsd::cxx::tree::traits< AvailabilityType, char, ::xsd::cxx::tree::schema_type::double_ > AvailabilityTraits;

    const AvailabilityOptional&
    availability () const;

    AvailabilityOptional&
    availability ();

    void
    availability (const AvailabilityType& x);

    void
    availability (const AvailabilityOptional& x);

    // duration
    //
    typedef ::xml_schema::Double DurationType;
    typedef ::xsd::cxx::tree::optional< DurationType > DurationOptional;
    typedef ::xsd::cxx::tree::traits< DurationType, char, ::xsd::cxx::tree::schema_type::double_ > DurationTraits;

    const DurationOptional&
    duration () const;

    DurationOptional&
    duration ();

    void
    duration (const DurationType& x);

    void
    duration (const DurationOptional& x);

    // mttf
    //
    typedef ::xml_schema::Double MttfType;
    typedef ::xsd::cxx::tree::optional< MttfType > MttfOptional;
    typedef ::xsd::cxx::tree::traits< MttfType, char, ::xsd::cxx::tree::schema_type::double_ > MttfTraits;

    const MttfOptional&
    mttf () const;

    MttfOptional&
    mttf ();

    void
    mttf (const MttfType& x);

    void
    mttf (const MttfOptional& x);

    // Constructors.
    //
    SimulationResult (const ModelIdType&,
                      const ConfigIdType&,
                      const TimestampType&,
                      const ValidResultType&,
                      const ReliabilityType&,
                      const NFailuresType&,
                      const NSimulatedRoundsType&);

    SimulationResult (const ::xercesc::DOMElement& e,
                      ::xml_schema::Flags f = 0,
                      ::xml_schema::Container* c = 0);

    SimulationResult (const SimulationResult& x,
                      ::xml_schema::Flags f = 0,
                      ::xml_schema::Container* c = 0);

    virtual SimulationResult*
    _clone (::xml_schema::Flags f = 0,
            ::xml_schema::Container* c = 0) const;

    SimulationResult&
    operator= (const SimulationResult& x);

    virtual 
    ~SimulationResult ();

    // Implementation.
    //
    protected:
    void
    parse (::xsd::cxx::xml::dom::parser< char >&,
           ::xml_schema::Flags);

    protected:
    ::xsd::cxx::tree::one< ReliabilityType > reliability_;
    ::xsd::cxx::tree::one< NFailuresType > nFailures_;
    ::xsd::cxx::tree::one< NSimulatedRoundsType > nSimulatedRounds_;
    AvailabilityOptional availability_;
    DurationOptional duration_;
    MttfOptional mttf_;
  };

  class AnalysisResult: public ::backendResults::Result
  {
    public:
    // probability
    //
    typedef ::commonTypes::Probability ProbabilityType;
    typedef ::xsd::cxx::tree::optional< ProbabilityType > ProbabilityOptional;
    typedef ::xsd::cxx::tree::traits< ProbabilityType, char > ProbabilityTraits;

    const ProbabilityOptional&
    probability () const;

    ProbabilityOptional&
    probability ();

    void
    probability (const ProbabilityType& x);

    void
    probability (const ProbabilityOptional& x);

    void
    probability (::std::auto_ptr< ProbabilityType > p);

    // decompositionNumber
    //
    typedef ::xml_schema::Int DecompositionNumberType;
    typedef ::xsd::cxx::tree::traits< DecompositionNumberType, char > DecompositionNumberTraits;

    const DecompositionNumberType&
    decompositionNumber () const;

    DecompositionNumberType&
    decompositionNumber ();

    void
    decompositionNumber (const DecompositionNumberType& x);

    // Constructors.
    //
    AnalysisResult (const ModelIdType&,
                    const ConfigIdType&,
                    const TimestampType&,
                    const ValidResultType&,
                    const DecompositionNumberType&);

    AnalysisResult (const ::xercesc::DOMElement& e,
                    ::xml_schema::Flags f = 0,
                    ::xml_schema::Container* c = 0);

    AnalysisResult (const AnalysisResult& x,
                    ::xml_schema::Flags f = 0,
                    ::xml_schema::Container* c = 0);

    virtual AnalysisResult*
    _clone (::xml_schema::Flags f = 0,
            ::xml_schema::Container* c = 0) const;

    AnalysisResult&
    operator= (const AnalysisResult& x);

    virtual 
    ~AnalysisResult ();

    // Implementation.
    //
    protected:
    void
    parse (::xsd::cxx::xml::dom::parser< char >&,
           ::xml_schema::Flags);

    protected:
    ProbabilityOptional probability_;
    ::xsd::cxx::tree::one< DecompositionNumberType > decompositionNumber_;
  };

  class BackendResults: public ::xml_schema::Type
  {
    public:
    // configuration
    //
    typedef ::configurations::Configuration ConfigurationType;
    typedef ::xsd::cxx::tree::sequence< ConfigurationType > ConfigurationSequence;
    typedef ConfigurationSequence::iterator ConfigurationIterator;
    typedef ConfigurationSequence::const_iterator ConfigurationConstIterator;
    typedef ::xsd::cxx::tree::traits< ConfigurationType, char > ConfigurationTraits;

    const ConfigurationSequence&
    configuration () const;

    ConfigurationSequence&
    configuration ();

    void
    configuration (const ConfigurationSequence& s);

    // result
    //
    typedef ::backendResults::Result ResultType;
    typedef ::xsd::cxx::tree::sequence< ResultType > ResultSequence;
    typedef ResultSequence::iterator ResultIterator;
    typedef ResultSequence::const_iterator ResultConstIterator;
    typedef ::xsd::cxx::tree::traits< ResultType, char > ResultTraits;

    const ResultSequence&
    result () const;

    ResultSequence&
    result ();

    void
    result (const ResultSequence& s);

    // issue
    //
    typedef ::commonTypes::Issue IssueType;
    typedef ::xsd::cxx::tree::sequence< IssueType > IssueSequence;
    typedef IssueSequence::iterator IssueIterator;
    typedef IssueSequence::const_iterator IssueConstIterator;
    typedef ::xsd::cxx::tree::traits< IssueType, char > IssueTraits;

    const IssueSequence&
    issue () const;

    IssueSequence&
    issue ();

    void
    issue (const IssueSequence& s);

    // Constructors.
    //
    BackendResults ();

    BackendResults (const ::xercesc::DOMElement& e,
                    ::xml_schema::Flags f = 0,
                    ::xml_schema::Container* c = 0);

    BackendResults (const BackendResults& x,
                    ::xml_schema::Flags f = 0,
                    ::xml_schema::Container* c = 0);

    virtual BackendResults*
    _clone (::xml_schema::Flags f = 0,
            ::xml_schema::Container* c = 0) const;

    BackendResults&
    operator= (const BackendResults& x);

    virtual 
    ~BackendResults ();

    // Implementation.
    //
    protected:
    void
    parse (::xsd::cxx::xml::dom::parser< char >&,
           ::xml_schema::Flags);

    protected:
    ConfigurationSequence configuration_;
    ResultSequence result_;
    IssueSequence issue_;
  };
}

#include <iosfwd>

#include <xercesc/sax/InputSource.hpp>
#include <xercesc/dom/DOMDocument.hpp>
#include <xercesc/dom/DOMErrorHandler.hpp>

namespace backendResults
{
  // Parse a URI or a local file.
  //

  ::std::auto_ptr< ::backendResults::BackendResults >
  backendResults (const ::std::string& uri,
                  ::xml_schema::Flags f = 0,
                  const ::xml_schema::Properties& p = ::xml_schema::Properties ());

  ::std::auto_ptr< ::backendResults::BackendResults >
  backendResults (const ::std::string& uri,
                  ::xml_schema::ErrorHandler& eh,
                  ::xml_schema::Flags f = 0,
                  const ::xml_schema::Properties& p = ::xml_schema::Properties ());

  ::std::auto_ptr< ::backendResults::BackendResults >
  backendResults (const ::std::string& uri,
                  ::xercesc::DOMErrorHandler& eh,
                  ::xml_schema::Flags f = 0,
                  const ::xml_schema::Properties& p = ::xml_schema::Properties ());

  // Parse std::istream.
  //

  ::std::auto_ptr< ::backendResults::BackendResults >
  backendResults (::std::istream& is,
                  ::xml_schema::Flags f = 0,
                  const ::xml_schema::Properties& p = ::xml_schema::Properties ());

  ::std::auto_ptr< ::backendResults::BackendResults >
  backendResults (::std::istream& is,
                  ::xml_schema::ErrorHandler& eh,
                  ::xml_schema::Flags f = 0,
                  const ::xml_schema::Properties& p = ::xml_schema::Properties ());

  ::std::auto_ptr< ::backendResults::BackendResults >
  backendResults (::std::istream& is,
                  ::xercesc::DOMErrorHandler& eh,
                  ::xml_schema::Flags f = 0,
                  const ::xml_schema::Properties& p = ::xml_schema::Properties ());

  ::std::auto_ptr< ::backendResults::BackendResults >
  backendResults (::std::istream& is,
                  const ::std::string& id,
                  ::xml_schema::Flags f = 0,
                  const ::xml_schema::Properties& p = ::xml_schema::Properties ());

  ::std::auto_ptr< ::backendResults::BackendResults >
  backendResults (::std::istream& is,
                  const ::std::string& id,
                  ::xml_schema::ErrorHandler& eh,
                  ::xml_schema::Flags f = 0,
                  const ::xml_schema::Properties& p = ::xml_schema::Properties ());

  ::std::auto_ptr< ::backendResults::BackendResults >
  backendResults (::std::istream& is,
                  const ::std::string& id,
                  ::xercesc::DOMErrorHandler& eh,
                  ::xml_schema::Flags f = 0,
                  const ::xml_schema::Properties& p = ::xml_schema::Properties ());

  // Parse xercesc::InputSource.
  //

  ::std::auto_ptr< ::backendResults::BackendResults >
  backendResults (::xercesc::InputSource& is,
                  ::xml_schema::Flags f = 0,
                  const ::xml_schema::Properties& p = ::xml_schema::Properties ());

  ::std::auto_ptr< ::backendResults::BackendResults >
  backendResults (::xercesc::InputSource& is,
                  ::xml_schema::ErrorHandler& eh,
                  ::xml_schema::Flags f = 0,
                  const ::xml_schema::Properties& p = ::xml_schema::Properties ());

  ::std::auto_ptr< ::backendResults::BackendResults >
  backendResults (::xercesc::InputSource& is,
                  ::xercesc::DOMErrorHandler& eh,
                  ::xml_schema::Flags f = 0,
                  const ::xml_schema::Properties& p = ::xml_schema::Properties ());

  // Parse xercesc::DOMDocument.
  //

  ::std::auto_ptr< ::backendResults::BackendResults >
  backendResults (const ::xercesc::DOMDocument& d,
                  ::xml_schema::Flags f = 0,
                  const ::xml_schema::Properties& p = ::xml_schema::Properties ());

  ::std::auto_ptr< ::backendResults::BackendResults >
  backendResults (::xml_schema::dom::auto_ptr< ::xercesc::DOMDocument > d,
                  ::xml_schema::Flags f = 0,
                  const ::xml_schema::Properties& p = ::xml_schema::Properties ());
}

#include <iosfwd>

#include <xercesc/dom/DOMDocument.hpp>
#include <xercesc/dom/DOMErrorHandler.hpp>
#include <xercesc/framework/XMLFormatter.hpp>

#include <xsd/cxx/xml/dom/auto-ptr.hxx>

namespace backendResults
{
  void
  operator<< (::xercesc::DOMElement&, const Result&);

  void
  operator<< (::xercesc::DOMElement&, const MincutResult&);

  void
  operator<< (::xercesc::DOMElement&, const SimulationResult&);

  void
  operator<< (::xercesc::DOMElement&, const AnalysisResult&);

  // Serialize to std::ostream.
  //

  void
  backendResults (::std::ostream& os,
                  const ::backendResults::BackendResults& x, 
                  const ::xml_schema::NamespaceInfomap& m = ::xml_schema::NamespaceInfomap (),
                  const ::std::string& e = "UTF-8",
                  ::xml_schema::Flags f = 0);

  void
  backendResults (::std::ostream& os,
                  const ::backendResults::BackendResults& x, 
                  ::xml_schema::ErrorHandler& eh,
                  const ::xml_schema::NamespaceInfomap& m = ::xml_schema::NamespaceInfomap (),
                  const ::std::string& e = "UTF-8",
                  ::xml_schema::Flags f = 0);

  void
  backendResults (::std::ostream& os,
                  const ::backendResults::BackendResults& x, 
                  ::xercesc::DOMErrorHandler& eh,
                  const ::xml_schema::NamespaceInfomap& m = ::xml_schema::NamespaceInfomap (),
                  const ::std::string& e = "UTF-8",
                  ::xml_schema::Flags f = 0);

  // Serialize to xercesc::XMLFormatTarget.
  //

  void
  backendResults (::xercesc::XMLFormatTarget& ft,
                  const ::backendResults::BackendResults& x, 
                  const ::xml_schema::NamespaceInfomap& m = ::xml_schema::NamespaceInfomap (),
                  const ::std::string& e = "UTF-8",
                  ::xml_schema::Flags f = 0);

  void
  backendResults (::xercesc::XMLFormatTarget& ft,
                  const ::backendResults::BackendResults& x, 
                  ::xml_schema::ErrorHandler& eh,
                  const ::xml_schema::NamespaceInfomap& m = ::xml_schema::NamespaceInfomap (),
                  const ::std::string& e = "UTF-8",
                  ::xml_schema::Flags f = 0);

  void
  backendResults (::xercesc::XMLFormatTarget& ft,
                  const ::backendResults::BackendResults& x, 
                  ::xercesc::DOMErrorHandler& eh,
                  const ::xml_schema::NamespaceInfomap& m = ::xml_schema::NamespaceInfomap (),
                  const ::std::string& e = "UTF-8",
                  ::xml_schema::Flags f = 0);

  // Serialize to an existing xercesc::DOMDocument.
  //

  void
  backendResults (::xercesc::DOMDocument& d,
                  const ::backendResults::BackendResults& x,
                  ::xml_schema::Flags f = 0);

  // Serialize to a new xercesc::DOMDocument.
  //

  ::xml_schema::dom::auto_ptr< ::xercesc::DOMDocument >
  backendResults (const ::backendResults::BackendResults& x, 
                  const ::xml_schema::NamespaceInfomap& m = ::xml_schema::NamespaceInfomap (),
                  ::xml_schema::Flags f = 0);

  void
  operator<< (::xercesc::DOMElement&, const BackendResults&);
}

#include <xsd/cxx/post.hxx>

// Begin epilogue.
//
//
// End epilogue.

#endif // CXX_ORE_BACK____FRONT_FUZZ_ED_STATIC_XSD_BACKEND_H
