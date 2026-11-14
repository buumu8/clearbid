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

<img src="./documents/images/ScreenRecord_v3.gif" alt="Clearbid Demo with AI agent generated results" width="100%">

## Final Presentation

[Watch the video presentation.](https://www.youtube.com/watch?v=MTf61AYkQVI)

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

## Architecture Diagram
![ClearBid Architecture Diagram](./documents/images/architecture_diagram_v3.jpeg)


## Tools and Technology
- Frontend: ReactJS
- Backend: express, NodeJS
- Orchestration: IBM watsonx Orchestrate 
    - to orchestrate AI agent(s)
- IDE: IBM Bob
    - to synthesize mock data
    - to connect to IBM watsonx agent(s)
    - to finish up the frontend and backend

## Workflow
![ClearBid Workflow](./documents/images/clearbid_workflow_v3.jpeg)

## UI/UX
### Landing Page
![Landing Page](./documents/images/LandingPage.png)

### New Purchase Request Page
![New Purchase Page](./documents/images/NewPurchaseRequest.png)

### AI Agent Result Page (Powered by IBM watsonx Orchestrate)
![AI Agent Result Page](./documents/images/AgentResultPage.png)

### Review Assistant (Powered by IBM watsonx Orchestrate)
![AI Agent Review Assistant](./documents/images/ReviewAssistant.png)

### Decision Page
![Decision Page](./documents/images/DecisionPage.png)

### Public Report Page
![Public Report](./documents/images/PublicReviewScreen.png)

### Public Assistant (Powered by IBM watsonx Orchestrate)
![Public Assistant](./documents/images/PublicAssistant.png)
