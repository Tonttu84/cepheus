# Rewards and the Law: Why Financial Payouts Stay Simulated

> **Draft for a hackathon demonstration. Written by an AI agent, not reviewed by a lawyer, not legal advice.**

Under decision D48, the Cepheus system includes a reward module: 1 euro for an answered check-in round, 1 euro for a completed small task, at most one rewarded task per day, and a payout offered at 10 euros.

In this build, **every amount, balance, and payout is strictly simulated**. This document explains the practical legal, fiscal, and clinical reasons why real money is not paid out in Finland, and evaluates alternatives that avoid administrative overhead and privacy violations.

---

## 1. Practical Obstacles to Paying Real Money in Finland

Paying small monetary amounts to individuals in Finland creates severe taxation, administrative, and data protection barriers.

### A. Taxable Income Under Finnish Law
Under Section 29(1) of the Finnish Income Tax Act (*Tuloverolaki* 1535/1992):
> "Veronalaisia tuloja ovat jäljempänä säädetyin rajoituksin verovelvollisen rahana tai rahanarvoisena etuna saamat tulot."  
> *(Taxable income includes, subject to statutory limitations, income received by the taxpayer in money or monetary benefit.)*

Furthermore, under Section 61(1) of the Income Tax Act, all income obtained as remuneration or consideration for an activity or work constitutes taxable earned income (*ansiotulo*). Payments made to an individual for answering questionnaires or performing tasks do not qualify as tax-exempt gifts; the Finnish Tax Administration (*Verohallinto*) treats them as non-wage compensation or fees (*työkorvaus* or *palkkio*).

### B. Incomes Register Reporting (*Tulorekisteri*)
Under Sections 6 and 10 of the Act on the Incomes Information System (*Laki tulotietojärjestelmästä* 53/2018), payers are legally obligated to report all paid wages, compensation, fees, and other taxable benefits to the Finnish Incomes Register (*Tulorekisteri*).

Crucially, under the official guidance of the Finnish Tax Administration:
1. **No Minimum Euro Threshold:** There is no lower monetary threshold for reporting (*ei euromääräistä alarajaa*). Even a 1-euro or 10-euro payout must be reported to the Incomes Register.
2. **Strict 5-Day Deadline:** Payment details must be reported to the Incomes Register within **five calendar days** of the payment date.
3. **Payer Administrative Burden:** Each payout requires submitting a separate earnings payment report with income category codes (such as code 336 *Työkorvaus* or code 316 *Muu veronalainen ansiotulo*). For a clinical service with hundreds of patients, filing hundreds of 10-euro micro-reports each month is an untenable administrative and accounting burden.

### C. The Data Protection Conflict: Destruction of Pseudonymity
To submit an earnings payment report to the Incomes Register under Section 10 of Act 53/2018, the payer must collect:
- The recipient's full legal name.
- The recipient's Finnish Personal Identity Code (*henkilötunnus* / HETU).
- The recipient's bank account number (IBAN).
- Tax withholding details (tax card / *verokortti*).

This requirement creates a fundamental conflict with data protection principles:
- **Destroys Pseudonymity:** Under decision D20, Cepheus deliberately does not store patient names, identity codes, or bank details. Collecting HETU and bank accounts completely dismantles the pseudonymity boundary.
- **Violates Data Minimisation (GDPR Article 5(1)(c)):** Forcing patients recovering from severe depression to disclose their banking details and tax identity solely to receive 10 euros violates the mandate that personal data must be limited to what is strictly necessary.
- **Privacy by Design (GDPR Article 25):** Storing financial credentials inside a mental health application introduces serious data breach risks (financial fraud, banking data compromise) where only health check-in data belongs.

---

## 2. Clinical and Ethical Obstacles

Even if tax reporting were simplified, paying cash for mental health check-ins raises profound clinical and ethical concerns:

1. **Distorting Check-in Accuracy (Gaming the System):**  
   Financial incentives introduce extrinsic motivation. Patients may complete check-ins hurriedly, dishonestly, or via automated scripts simply to earn the euro, defeating the clinical objective of accurately tracking depression relapse symptoms.
2. **Inducement and Undue Influence in a Healthcare Relationship:**  
   Offering monetary payments to vulnerable patients recovering from major depressive episodes creates ethical concerns regarding undue inducement. Patients in financial distress might feel pressured to take part or hesitate to report worsening symptoms if they fear it could affect their participation.
3. **Handling Financial Data and Regulatory Exposure:**  
   Executing bank payouts requires collecting IBANs, processing payouts, and complying with anti-money laundering (AML) and Know Your Customer (KYC) regulations, turning a lightweight wellbeing tool into a payment intermediary.
4. **Inequality and Stigma:**  
   A 1-euro reward has very different meaning for someone living on minimum social assistance compared to a high-income patient, introducing inequality into post-treatment clinical follow-up.

---

## 3. Practical Alternatives that Avoid Administration

If future iterations wish to retain adherence reinforcement without Finnish tax and banking overhead, three realistic alternatives exist:

### Alternative 1: Collective Charitable Donations
- **Mechanism:** For every answered check-in round, the clinic or sponsoring foundation pledges 1 euro (up to a fixed monthly maximum) to an independent mental health charity chosen by the participant (for example, *MIELI Suomen Mielenterveys ry*).
- **Advantage:** Patients experience positive social impact and altruistic motivation; no money flows to the patient's personal bank account, completely eliminating individual tax reporting, HETU collection, and Tulorekisteri filings.
- **Caveat:** Corporate donations on behalf of individuals must be legally structured as general organizational donations to avoid being deemed constructive taxable fringe benefits, and some participants may find collective donations less personally motivating than direct rewards.

### Alternative 2: Non-Monetary Digital Acknowledgments and Visible Progress
- **Mechanism:** Providing gentle visual acknowledgments, such as a simple count of completed rounds or completed daily walks (decisions D38 and D42).
- **Advantage:** Zero financial transactions, zero tax administration, and zero personal financial data collection. Completely maintains privacy by design.
- **Caveat:** Must strictly respect the core mandate of `AGENTS.md`: "No streaks, no scores, and a missed answer is recorded as missed, never punished." If gamification creates guilt or anxiety for missed rounds, it can harm a depressed patient. Progress displays must remain optional and switchable.

### Alternative 3: Low-Value Vouchers (e.g. Public Transport or Culture Tickets)
- **Mechanism:** Offering a single local public transport ticket (e.g., an HSL single mobile ticket) or a city library / cultural pass upon completing a multi-week follow-up milestone.
- **Advantage:** Directly supports social mobility and behavioral activation (encouraging patients to leave home and take walks).
- **Caveat:** Under Finnish tax rules, vouchers given in exchange for performing an activity (completing questionnaires) are still treated as consideration for work (*vastike*), which the Tax Administration may still classify as taxable earned income, potentially re-triggering Tulorekisteri reporting requirements.

---

## 4. Sources

1. **Tuloverolaki (1535/1992)**  
   *Finlex URI:* https://www.finlex.fi/fi/lainsaadanto/1992/1535  
   *Section 29(1):* "Veronalaisia tuloja ovat jäljempänä säädetyin rajoituksin verovelvollisen rahana tai rahanarvoisena etuna saamat tulot."  
   *Section 61(1):* Veronalaisia ansiotuloja ovat muun muassa työsuhteen perusteella saatu palkka ja siihen rinnastettava tulo sekä muu työstä tai tehtävästä saatu korvaus.
2. **Laki tulotietojärjestelmästä (53/2018)**  
   *Finlex URI:* https://www.finlex.fi/fi/lainsaadanto/2018/53  
   *Section 6 & Section 10:* Payers are obligated to report all paid wages, fees, and taxable benefits to the Incomes Register Unit.  
   *Section 10(1):* "Tiedon tuottajan on salassapitosäännösten ja muiden tiedon saantia koskevien rajoitusten estämättä annettava Tulorekisteriyksikölle 6 §:n 2–5 momentissa tarkoitetut tiedot..."
3. **Verohallinto / Tulorekisteri Official Guidance**  
   *Website:* https://www.vero.fi/tulorekisteri  
   *Palkkojen ilmoittaminen:* All paid compensations and fees must be reported to the Incomes Register within 5 calendar days, with no minimum euro threshold (*ei euromääräistä alarajaa*).
4. **Regulation (EU) 2016/679 (GDPR)**  
   *EUR-Lex URI:* https://eur-lex.europa.eu/eli/reg/2016/679/oj  
   *Article 5(1)(c) (Data minimisation):* Processing must be adequate, relevant, and limited to what is necessary.  
   *Article 25 (Data protection by design and by default):* Privacy safeguards must be embedded into system architecture.
