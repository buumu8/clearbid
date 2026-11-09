# ClearBid: Transparent Government Procurement 

Built for: IBM SkillsBuild AI Experiential Learning Lab

![Banner](./frontend/src/assets/logo-full.svg)

## Team: Void

## Track: 

Government & Public Services

## Project summary:

An AI agent system that reviews vendor quotes for public purchases. It compares prices with the market and with past government purchases, flags fraud and collusion, and publishes plain-language reports. AI flags and explains; the human officer decides.

## Demo

<span style="font-size:24px">**[Click to view a Static Demo with seed data](https://buumu8.github.io/clearbid)**</span>

<img src="./documents/images/ClearBid_TonerDemo.gif" alt="Clearbid Demo with AI agent generated results" width="100%">

## Final Presentation

<a href="https://youtu.be/4Mm_hvbUmiM" target="_blank">
  <img src="https://i9.ytimg.com/vi_webp/4Mm_hvbUmiM/mqdefault.webp?v=6af16c85&sqp=COzXxdcG&rs=AOn4CLDL8nYs4IzXDSb1BsS02KJ2VFjSVg" alt="Watch the video presentation" width="560" height="315" border="10" />
</a>


## Target users:
Primary: Procurement officers at city, state and federal agencies
Secondary: Auditors and inspectors general
Public: Citizens and journalists

## Problem it solves
- Manual price research is slow and inconsistent
- Overpricing, bid rigging and shell companies waste public money
- Citizens can't easily see how or why money was spent

## Benefits
- Officers check whether prices are reasonable in minutes instead of hours
- Fraud is caught before the contract is awarded
- Every decision has a written record that holds up in an audit
- Public trust grows through open, readable reports

## Workflow
![ClearBid Workflow](./documents/images/clearbid_workflow_v2.jpeg)

## Tools and Technology
- Frontend: ReactJS
- Backend: express, NodeJS
- Orchestration: IBM watsonx Orchestrate 
    - to orchestrate AI agent(s)
- IDE: IBM Bob
    - to synthesize mock data
    - to connect to IBM watsonx agent(s)
    - to finish up the frontend and backend


## UI/UX
### Landing Page
![Landing Page](./documents/images/LandingPage.png)

### New Purchase Request Page
![New Purchase Page](./documents/images/NewPurchaseRequest.png)

### AI Agent Result Page
![AI Agent Result Page](./documents/images/AgentResultPage.png)

### Decision Page
![Decision Page](./documents/images/DecisionPage.png)

### Public Report Page
![Public Report](./documents/images/PublicReviewScreen.png)
