# Compliance gaps and follow-up register

This document is a **documentation-only gap register** for the local challenge prototype. It does not implement controls, establish applicability, or claim conformity with any framework. Each item must be validated against the organization's scope, risk assessment, contracts, privacy roles, system boundary, and the edition adopted by the organization. ISO management-system standards require an organization-wide management system and operating evidence; SOC 2 is an independent examination; PCI DSS applicability depends on the actual cardholder data environment (CDE) and connected or security-impacting systems.

## Priority legend

- **P0 — Decide before production:** scope, data classification, ownership, risk and privacy/legal applicability.
- **P1 — Required before production use:** operational and technical controls for the real deployment.
- **P2 — Operate and evidence:** recurring monitoring, reviews, effectiveness and assurance evidence.
- **Conditional:** required only when the relevant processing, AI use, or PCI scope applies.

These priorities are a planning aid, not a formal statement of standard requirements.

## Cross-framework work

| Priority | Gap / follow-up | Evidence to produce |
| --- | --- | --- |
| P0 | Define legal entity, services, locations, users, infrastructure, suppliers, data flows, system boundaries, exclusions, and control owners. Determine how the service relates to payment processing and the CDE. | Approved scope and boundary diagrams; asset and data-flow inventory; owner/RACI list; applicability decisions. |
| P0 | Establish risk assessment and treatment, policy, control objectives, exceptions, and management review. | Risk register; risk-treatment plan; approved control/applicability statement where relevant; policy approvals and review records. |
| P0 | Classify collected process names and logged-in usernames. Confirm purpose, lawful basis, notice, minimization, retention, location, processor/controller roles, and any cross-border transfer. | Data inventory; privacy assessment/DPIA where needed; notices and contracts; approved retention schedule and deletion evidence. |
| P1 | Replace static demo credentials with managed identities, per-agent credentials, least privilege, MFA for human access, lifecycle/rotation/revocation, and secure secret delivery. | IAM design; access approvals; periodic access review; rotation/revocation records; secret-store configuration. |
| P1 | Enforce TLS for all non-local traffic, strong service authentication, secure key/certificate lifecycle, and encryption at rest with managed keys where risk requires it. | TLS configuration and tests; key-management procedure; encryption configuration and key access evidence. |
| P1 | Implement secure SDLC, peer review, protected branches, dependency/container scanning, patch SLAs, artifact provenance, deployment approvals, and vulnerability remediation. | SDLC policy; CI results; SBOMs; signed build provenance; vulnerability register and remediation evidence. |
| P1 | Build production-grade telemetry, alerting, incident response, time synchronization, protected audit storage, and auditable administrative actions. | Logging/monitoring standards; alert tests; incident plan/tabletop; sample complete and protected audit trail. |
| P1 | Define backup, restore, disaster recovery, availability targets, capacity, and tested recovery procedures. | Approved RPO/RTO; backup policies; restore-test records; recovery runbook and test outcomes. |
| P1 | Implement enforceable retention and deletion across database, object storage, replicas, logs, and backups; document exceptions and legal holds. | Deletion job/control; deletion and exception logs; backup expiry behavior; retention review evidence. |
| P1 | Assess suppliers and hosted services, including cloud, image registries, package repositories, and subprocessors. | Supplier inventory and risk assessments; contracts/DPAs; assurance reports; ongoing review records. |
| P2 | Operate change management, configuration baselines, access reviews, control testing, internal audits/independent assessments, corrective actions, and management review. | Change tickets; configuration drift reports; test populations/results; audit findings and closure evidence; management minutes. |

## ISO/IEC 27001:2022 — ISMS

The prototype demonstrates a few technical ideas (authenticated ingestion, input validation, limited reviewer access, event categories, and data-integrity checks). It does not establish an ISMS. The organization must define the ISMS context and scope, leadership and responsibilities, risk assessment/treatment, information-security objectives, resources and competence, operational controls, performance evaluation, internal audit, management review, nonconformity/corrective action, and continual improvement. It must determine applicable Annex A controls and justify decisions against its risks and requirements; this repository is not a Statement of Applicability.

Additional engineering work includes production identity and least privilege, secure deployment baselines, TLS, managed secrets/keys, vulnerability and patch management, supply-chain controls, monitoring/incident handling, tested resilience, supplier oversight, and retention enforcement. Owners must operate these controls and retain evidence over time.

Reference: [ISO/IEC 27001:2022](https://www.iso.org/standard/27001) and its published [2024 amendment](https://www.iso.org/standard/88435.html).

## ISO/IEC 27701:2025 — PIMS and privacy management

The collector includes process names and logged-in usernames, which can be personal data depending on context. Minimized fields and a configured retention value do not establish privacy compliance. Determine controller/processor roles, purpose and lawful basis, notices, data-subject rights, privacy risk assessment/DPIA where applicable, privacy-by-design approvals, accuracy, retention and deletion, breach handling, subprocessors, international transfers, and accountability. Limit or remove identifying fields if they are not necessary. Extend the security/data lifecycle to backups, logs, and exports.

Confirm the edition required by the organization: ISO now lists [ISO/IEC 27701:2025](https://www.iso.org/standard/27701) as published and [ISO/IEC 27701:2019](https://www.iso.org/standard/71670.html) as withdrawn. Confirm contractual and transition expectations rather than assuming editions are equivalent.

## ISO/IEC 42001:2023 — AI management system

This prototype has no AI system, model, or AI decision-making function. Record and approve that scope determination. If AI is introduced into collection, triage, scoring, summarization, or decision-making, reassess the AIMS scope and risks before use. Establish AI-system inventory and lifecycle ownership, intended-use boundaries, impact/risk assessment, data and model governance, human oversight, transparency, monitoring, incident handling, supplier governance, and performance evidence as applicable to the use case.

Reference: [ISO/IEC 42001:2023](https://committee.iso.org/cms/live/live/en/sites/isoorg/contents/data/standard/08/12/81230.html).

## SOC 2 — Trust Services Criteria

The demo's selected mechanisms are not a SOC 2 report or evidence of control effectiveness over a review period. Define the service/system description and boundaries, applicable Trust Services Categories and criteria, commitments, control owners, complementary user-entity controls, subservice organizations and carve-outs. Design and operate controls for security and any selected availability, processing integrity, confidentiality, or privacy commitments. Retain dated populations, approvals, access/change evidence, incidents, monitoring, vendor oversight, and tests. Engage an independent CPA for a SOC 2 examination; Type 2 requires evidence over the defined period, not a point-in-time walkthrough.

Reference: [AICPA SOC resources and Trust Services Criteria](https://www.aicpa-cima.com/resources/landing/system-and-organization-controls-soc-suite-of-services).

## PCI DSS v4.0.1 — Conditional on scope

Do not send cardholder data or sensitive authentication data to this prototype. First map payment-data flows and determine whether the service stores, processes, transmits, connects to, or can impact the CDE or its security. Obtain a qualified scope determination with the acquirer/payment brands and assessor as appropriate; this demo cannot establish scope reduction or segmentation effectiveness.

If applicable, map the real architecture and operational controls to the current PCI DSS requirements and validation method. Address, as applicable, network security controls and segmentation, secure configurations, account/data protection, encryption and key management, malware defenses, secure development, vulnerability management, access control/MFA, physical security, logging/monitoring/testing, incident response, policies, service-provider responsibilities, and required assessment evidence. Validate with the appropriate assessor and current PCI SSC material.

Reference: [PCI SSC document library](https://www.pcisecuritystandards.org/document_library/?category=pcidss) and [PCI DSS overview](https://www.pcisecuritystandards.org/standards/pci-dss/).

## Agent integrity on the destination host

The client currently minimizes the snapshot, uses a per-agent bearer token, checks token-file permissions, verifies TLS certificates through the default `requests` behavior, rejects remote cleartext HTTP, and does not follow redirects. These measures reduce exposure in transit and accidental secret disclosure; they do not prove that a collected snapshot is truthful or that the script was not modified on the target machine.

**Absolute non-alterability cannot be guaranteed by a script running on a host controlled by an administrator/root attacker.** Such an attacker can replace the file, interpreter, dependencies, runtime, token, or collected values, or bypass local checks. File permissions, a locally stored hash, or a signature verification routine shipped beside the script are not a trust anchor against that attacker.

For a production design, consider a signed, versioned agent package and a trusted update channel; verify signatures in a separately trusted installer/package manager; use OS controls to restrict writes and execution (least-privilege service account, root-owned files, mandatory access controls, application allowlisting, and protected service configuration); protect token material with an OS secret store or workload identity; support revocation and staged updates; and report agent version/build identity. Where the threat model requires proof of host state, use hardware-backed measured boot/remote attestation with a verifier and a policy decision before accepting evidence. Even attestation proves only specified measurements at a point in time and needs a maintained trust chain. Treat collected host data as an authenticated claim from an enrolled identity, not as independent proof of a compliant host.

Recommended future verification: tamper with the installed package and prove signature verification blocks installation/update; verify non-root execution and write restrictions; rotate/revoke an agent identity; test remote HTTP rejection and HTTPS certificate validation; validate build provenance; document the threat model and attestation coverage/limitations.

## Suggested sequence after the challenge

1. Approve the scope, data flow, risk assessment, privacy roles, and PCI applicability decision.
2. Assign control owners and establish policies, secure SDLC, IAM/secret management, incident response, backups, retention, supplier management, and monitoring.
3. Select production architecture and implement TLS, identity, encryption, least privilege, resilience, logging, deletion, and signed agent distribution/verification.
4. Operate controls for a defined evidence period; review access, changes, vulnerabilities, incidents, suppliers, and control effectiveness.
5. Perform a gap assessment against the exact adopted editions and engage the appropriate certification body, CPA, or PCI assessor for the desired assurance.

