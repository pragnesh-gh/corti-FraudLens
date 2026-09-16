The problem

Medical coding fraud is a big problem that eats up serious budgets in healthcare that would have otherwise went to actual care.
Different types of coding fraud commonly encountered:

* Upcoding (billing higher-tier codes than warranted)
* Unbundling (billing separately for bundled procedures)
* Phantom billing (services never rendered)
* Diagnosis inflation (falsifying diagnosis codes to justify procedures)
* Cloning (copy-paste documentation to support billing)



The market size

Fraud Estimates (NHCAA): Financial losses from healthcare fraud are in the tens of billions annually. The conservative estimate is 3% of total health expenditure – conservatively $159 billion annually.
DOJ False Claims Act Recoveries (FY2024): $2.9 billion in settlements/judgments
The SIU market alone (insurer-side fraud investigation) is estimated at $3-5B annually.


The ICP

The retro-spective investigators

* Attorney-style investigators specialised legal consultancy trying to build fraud cases
* Investigators at State Medicaid Fraud Control Units
* Investigators at Special Investigation Units at insurers


The pro-active investigators

* healthcare providers that want to avoid that errors get categorized as fraud (providers hire expensive coding consultants ($150-$500/hr) for manual chart audits that sample <1% of claims.) Providers spent an estimated $1B+ annually on external coding audit services.
* The healthcare compliance software market is estimated at $2-3B and growing 12-15% annually


The citizen-empowered private people

* Private citizens (relators) who can get up to 15-30% of recoveries

The solution

* Inputs: the medical case and medical and billing codes - optionally including the patient's past medical history and charts
* Output 1: case-level scoring of codes in terms of alignment
* Output 2: case-aggregated pattern matching controlling for expected normal distribution and historical data specific to the provider, geography, patient demographics


The tech under the hood:

1. text generation:
    1. extract clinical facts from the case (we need to crunch hundreds of thousands of cases, so we need to minimize inputs initially)
    2. optionally upon request from an agent: summarise and structure the historic patient chart
2. medical coding: based on the case note we predict the correct codes
    1. the remainder of codes that our model did not predict or with low confidence: these are the codes our agentic setup now goes into detail with
3. agentic framework: several orchestrated agents
    1. case-level reasoning on unmatched codes: how grounded is the unmatched code in the note?
    2. agent requests extended verification: how grounded is the unmatched code in the extended. patient journal charts? (interloop with textgen support to summarise the chart)
    3. case-level judgement and fraud scoring vs error-scoring into the categories (upcoding, unbundling, phantom billing, diagnosis inflation, cloning),
    4. agent to assess the economic impact of the error or fraud
    5. agent to aggregate and extract key findings per case to write into a DB
    6. aggregate pattern matching agent to crunch through the DB

The demo

* synthetic cases where we inject fraud (we put ourselves into the shoes of the fraudsters to smoke 'em out)



