---
article_id: "static-ip-sim-wifi-offload-traffic-steering-rules"
title: "Static IP on SIM W/ LTE + Wifi Offload to Cloud - Traffic Steering configuration"
product: "Fleet 3"
category: "Networking"
tags: ["Wifi Offload", "Static SIM Card", "LTE + Wifi Offload", "Traffic Steering Rules", "Networking"]
severity: "High"
status: "Draft"
owner: "Bobby Engle"
last_verified: "2026-05-03"
source_issue: "https://github.com/bobbyengleiii-lgtm/AxonFleetKnowledgePortal/issues/14"
updated: "2026-03-12"
---

# Static IP on SIM W/ LTE + Wifi Offload to Cloud - Traffic Steering configuration

## 1) Client Issue Description
Client Issue Description

The agency reported that when **WiFi as WAN was enabled on the Cradlepoint router**, vehicles intermittently lost communication between the **Fleet Hub and the Fleet Dashboard**. The issue occurred after enabling wireless offloading using a local access point.

Vehicles were equipped with **SIM cards configured with static public IP addresses** for cellular communication. When WiFi connectivity was introduced, the Fleet system lost connectivity to the Hub’s local IP address and Fleet services intermittently disconnected.

The issue was observed during troubleshooting and testing of network traffic steering behavior on the vehicle router.

## 2) Observed Symptoms
* Fleet Hub communication to the Fleet Dashboard dropped when **WiFi as WAN was enabled**
* Communication remained stable when operating solely on **cellular (WWAN)**
* Packet capture confirmed **bidirectional traffic while operating on WWAN**
* Traffic could not be followed outside the router console when WiFi offloading was active
* Local Hub communication appeared to be impacted by **routing/traffic steering behavior**
* Vehicles were using **static IP SIM cards intended for cellular network paths**
* Issue was reproducible when switching between **WWAN-only and WWAN + WiFi configurations**

## 3) Root Cause
Traffic steering behavior on the vehicle router allowed Fleet-related traffic to be routed over the **WiFi WAN interface instead of the cellular interface**, which caused communication failures.

Because the SIM cards were configured with **static public IP addresses tied to the cell**

## 4) Resolution Performed
Traffic steering policies were reviewed and corrected within the router configuration in NetCloud.

A routing policy was implemented to ensure Fleet service traffic was pinned to the cellular interface (WWAN) while allowing non-critical internet traffic to utilize WiFi offloading when available.

Added FQDN(s) that use Fleet Traffic -> Host Address Page (Add FQDN Name -> Within Netcloud) -> Then that will be used within the traffic steering rule set.

FQDN's =
.axon.com
.evidence.com
.cloudfront.net
.amazonaws.com
.cloudfront.net


Additionally, local network ranges were excluded from WAN routing policies to ensure LAN communication between the Fleet Hub and connected devices remained local and unaffected by WAN interface changes.

Verification was performed using packet capture on the router interfaces to confirm that Fleet-related traffic was consistently routed over the cellular interface while general internet traffic successfully offloaded to WiFi. System communication with the Fleet Dashboard and Hub was restored and remained stable after applying the corrected policies.

## 5) Prevention / Education Provided
We’re using FQDN-based steering aligned to Axon service domains, ensuring all Fleet traffic remains on the cellular interface for static IP consistency, while allowing non-critical traffic to offload to WiFi.

Guidance was provided on validating traffic path selection when enabling WiFi offloading in vehicle network deployments.

Best practices include ensuring that:

* Fleet service domains are explicitly routed over the cellular interface when static IP SIM cards are in use.
* Local LAN subnets are excluded from WAN traffic steering policies to prevent unintended routing of internal communication.
* Packet capture tools within the router diagnostics are used to confirm interface-level traffic flow during testing.

Engineers were advised to verify routing behavior after enabling WiFi as WAN to confirm that Fleet traffic remains on cellular while non-critical traffic is permitted to offload to WiFi. This validation helps prevent communication interruptions with the Fleet Hub and backend services.
