You are helping build a real commercial SaaS product for renovation and construction companies.

The current working name is **QuoteAI**. The final brand name is not decided yet.

## Product Goal

Build a multilingual web application/PWA that helps renovation and construction companies create professional estimates faster.

The user can describe a job using:

* voice
* text
* photos

The application converts that information into a structured estimate using the company's own prices, services, terminology and historical data when available.

The product must also manage work added after the original estimate, so additional work can be documented, priced and approved by the customer.

## Core Problem

Many small and medium renovation companies currently:

* calculate estimates manually
* keep prices in Excel, paper, WhatsApp or memory
* send only a final total instead of a structured estimate
* waste time preparing offers
* have disagreements about work that was or was not included
* struggle to document additional work
* work with customers who speak a different language
* depend heavily on the owner or manager to calculate prices

The product should make this process faster, more professional and easier to document.

## Target Users

Initial target:

* small and medium renovation companies
* approximately 2–20 workers
* residential renovation
* apartments and houses
* companies operating in Moldova and Europe
* especially companies whose workers and customers speak different languages

Initial work categories may include:

* demolition
* painting
* plastering
* drywall
* flooring
* tiles
* bathrooms
* kitchens
* electrical work
* plumbing
* general interior renovation

## Supported Languages

Initial languages:

* Romanian
* Russian
* English
* Italian
* French
* German
* Spanish

Input language and output language must be independent.

Example:

User interface: Romanian
Voice input: Russian
Company price catalog: Italian
Customer language: German
Final estimate: German

Mixed-language input should also be supported when practical.

Example:

"Trebuie dat jos кафель-ul vechi, după asta punem gresie nouă, circa 20 metri."

The system should understand the meaning, not simply translate the sentence.

## Core Architecture Principle

Never build the business logic around language-specific text.

Convert user input into canonical structured data.

Example:

```json
{
  "concept": "REMOVE_FLOOR_TILES",
  "quantity": 18,
  "unit": "m2"
}
```

Translations and customer-facing descriptions are presentation layers.

## Critical AI Rule

The LLM must NOT be responsible for financial calculations.

AI may:

* understand voice or text
* extract work items
* classify work
* identify quantities
* analyze photos
* detect missing information
* match work to catalog items
* write descriptions
* translate content
* suggest possible matches

Deterministic application code must calculate:

* unit price × quantity
* discounts
* taxes
* margins
* subtotals
* totals
* payment schedules

Never allow the LLM to invent prices silently.

## Company Price Data

Each company must be able to maintain its own catalog.

Example:

```text
Install drywall        m2      €28
Remove tiles           m2      €18
Interior painting      m2      €11
Electric socket        unit    €45
Worker                 day     €220
Waste removal          unit    €350
```

The system should later support importing company data from:

* CSV
* Excel
* existing databases
* APIs

For the first MVP, CSV/Excel import is enough.

The company's own data should always take priority over generic AI knowledge.

## Main Workflow

```text
Voice / Text / Photos
        ↓
Transcription
        ↓
AI extraction
        ↓
Structured job data
        ↓
Missing information detection
        ↓
Company catalog matching
        ↓
Deterministic pricing engine
        ↓
User review/edit
        ↓
Language generation / translation
        ↓
Estimate
        ↓
PDF + public customer link
        ↓
Customer approval
```

## Additional Work / Variations

This is a major product differentiator.

Example:

Original estimate:
€8,500

During the project the customer asks for:

* 6 additional electrical sockets
* another drywall wall
* additional painting

The contractor should be able to:

1. take a photo
2. record a short voice note
3. let AI identify the additional work
4. calculate the price using company prices
5. generate a variation/change order
6. send it to the customer
7. receive approval
8. permanently record what was approved

The system must maintain a clear history between:

* original scope
* added work
* removed work
* changed work
* approved amounts

## MVP Scope

The first version must be a usable pilot, not a complete ERP.

Build:

### Authentication

* sign up
* sign in
* organization/company account

### Company

* company name
* logo
* contact information
* tax information
* default currency
* default language
* customer document language
* default VAT/tax settings

### Customers

* create customer
* edit customer
* contact details
* preferred language

### Projects

* customer
* address
* description
* status
* attachments

### Price Catalog

* categories
* work items
* unit
* cost
* selling price
* currency
* CSV/Excel import

### Estimates

* manual estimate creation
* line items
* quantities
* unit prices
* discounts
* notes
* totals
* editing

### AI Estimate Creation

* text input
* voice input
* photo attachments
* structured AI extraction
* catalog matching
* missing-information detection
* user confirmation before finalization

### Multilingual Output

Generate estimate content in:

* Romanian
* Russian
* English
* Italian
* French
* German
* Spanish

### PDF

Generate a clean professional estimate containing:

* company information
* customer information
* project information
* line items
* totals
* terms
* validity period
* payment conditions

### Public Customer Link

Customer should not need an account.

Customer can:

* view estimate
* see total
* see included work
* approve the estimate

### Variations

* create additional work
* link it to original project
* calculate additional value
* send for approval
* record approval

### Audit History

For important customer approvals store:

* document version
* timestamp
* approval event
* basic technical metadata
* immutable version reference

## Explicitly NOT in MVP

Do not build unless specifically requested:

* full accounting
* payroll
* inventory management
* advanced CRM
* employee scheduling
* Gantt charts
* native iOS application
* native Android application
* marketplace
* full ERP
* electronic tax invoicing
* automatic legal compliance guarantees
* automatic measurements from photos
* official national construction price databases
* complex WhatsApp integration

## Product Principles

1. Build the smallest useful commercial product.
2. Prefer simple architecture.
3. Avoid premature abstraction.
4. Avoid unnecessary dependencies.
5. Mobile-first.
6. PWA preferred over native mobile apps.
7. Use strict typing.
8. Validate all important data server-side.
9. Financial calculations must be deterministic.
10. AI output must be validated against schemas.
11. Never silently trust AI-generated structured data.
12. User must be able to edit AI output.
13. Preserve estimate versions.
14. Treat accepted estimates as immutable versions.
15. Design for multilingual use from the beginning.
16. Do not hardcode business logic around one country.
17. Separate language, country, currency and tax profile.
18. Keep the architecture extensible without overengineering.

## Conceptual Data Entities

Expect approximately these entities:

```text
User
Organization
OrganizationMember
Customer
Project
CatalogCategory
CatalogItem
Quote
QuoteVersion
QuoteItem
Variation
VariationVersion
VariationItem
Attachment
AIExtraction
PublicQuoteLink
Acceptance
AuditEvent
Subscription
```

Do not assume this schema is final. Review it before implementation.

## Important Data Separation

These concepts must be separate:

```text
interface_language
input_language
company_language
customer_language
document_language
country
currency
tax_profile
```

Language must never imply country.

German may mean Germany, Austria or Switzerland.

French may mean France, Belgium or Switzerland.

## Money

Never use normal floating-point arithmetic for money.

Use a safe decimal strategy appropriate to the selected stack.

Currency should be stored explicitly.

## AI Extraction

AI should return structured schema-validated output.

Example:

```json
{
  "job_type": "bathroom_renovation",
  "items": [
    {
      "concept": "REMOVE_WALL_TILES",
      "quantity": 22,
      "unit": "m2",
      "catalog_match_id": null,
      "confidence": 0.91
    }
  ],
  "assumptions": [],
  "missing_information": [
    "Tile installation area is unclear."
  ]
}
```

Never treat low-confidence data as confirmed.

## Photos

Photos may help identify:

* room type
* visible materials
* possible work categories
* existing conditions

Do not promise accurate measurements from ordinary photos.

Human verification is required.

## UX

The application should feel fast and simple.

A contractor on a construction site should be able to use the core workflow from a phone.

Avoid enterprise-style complexity.

The ideal workflow is approximately:

```text
New Estimate
→ Record voice
→ Add photos
→ AI prepares draft
→ Review prices
→ Generate
→ Send
```

## Business Model

Likely SaaS subscription.

Possible future tiers:

```text
Solo
Pro
Team
```

The first pilot customers may also pay an onboarding/setup fee for:

* importing company prices
* configuring services
* importing previous estimates
* adapting terminology

Billing is not the first development priority.

## Legal / Safety Position

The application assists the company in preparing estimates.

It does not guarantee:

* legal compliance
* construction accuracy
* tax correctness
* pricing correctness
* measurement correctness

The company/user approves the final document.

AI output must always be reviewable before it becomes customer-facing.

## Development Context

The project will be developed mainly in VS Code using Claude Code / Claude Sonnet or Opus.

Development should be fast, but production quality matters.

The immediate goal is a pilot that can be tested with a real renovation company within days.

## Your Working Rules

Before writing significant code:

1. Read this entire specification.
2. Identify assumptions.
3. Propose the technical architecture.
4. Explain major technology choices briefly.
5. Identify any risky decisions.
6. Keep the implementation focused on the MVP.

When implementing:

* work incrementally
* keep the application runnable
* create migrations properly
* write critical tests
* do not introduce unnecessary abstractions
* do not change architectural decisions silently
* do not implement features outside the defined scope
* document important decisions
* report uncertainties instead of inventing requirements

## First Task

Do not write application code yet.

Analyze this product specification and propose the optimal technical stack and project architecture for building the first production-capable MVP as quickly as possible.

For each major technology choice, explain:

* what you recommend
* why
* main downside
* whether it is easy to replace later

Then propose the first development milestones in implementation order.

Keep the answer practical and concise.
