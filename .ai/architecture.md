%% AccessAgents AWS Serverless Architecture
%% Updated: December 2024

graph TB
    subgraph clients [Clients]
        Web["🖥️ Web Dashboard<br/>React + Amplify"]
    end

    subgraph apiLayer [AWS API Layer]
        APIGW["🌐 API Gateway REST"]
        WSAPI["📡 API Gateway WebSocket"]
        Authorizer["🔐 Lambda Authorizer"]
    end

    subgraph auth [Authentication]
        Cognito["👤 Amazon Cognito<br/>User Pool"]
    end

    subgraph lambdas [Lambda Functions]
        ScanMgr["⚡ ScanManager<br/>Orchestration"]
        WSHandler["📡 WebSocket Handler<br/>Real-time Updates"]
        AuditorLambda["👀 Auditor Lambda<br/>Axe-Core Scanner"]
        InjectorLambda["💉 Injector Lambda<br/>DOM Fixes"]
    end

    subgraph bedrock [Amazon Bedrock]
        Agent["🧠 Orchestrator Agent<br/>Claude 3.5 Sonnet"]
        
        subgraph actionGroups [Action Groups]
            AuditorAG["Auditor AG"]
            InjectorAG["Injector AG"]
        end
    end

    subgraph storage [Storage Layer]
        Aurora[("🐘 Aurora PostgreSQL<br/>Serverless v2")]
        S3["📦 S3<br/>Reports & Snapshots"]
    end

    subgraph browser [Browser Execution]
        Browserless["🌐 Browserless.io<br/>Cloud Browsers"]
    end

    %% Client Flow
    Web --> APIGW
    Web --> WSAPI
    
    %% Auth Flow
    APIGW --> Authorizer
    Authorizer --> Cognito
    Authorizer --> ScanMgr
    WSAPI --> WSHandler
    
    %% Scan Flow
    ScanMgr --> Agent
    Agent --> AuditorAG
    Agent --> InjectorAG
    AuditorAG --> AuditorLambda
    InjectorAG --> InjectorLambda
    
    %% Browser Execution
    AuditorLambda --> Browserless
    InjectorLambda --> Browserless
    
    %% Storage
    ScanMgr --> Aurora
    ScanMgr --> S3
    WSHandler --> Aurora

    %% Legend
    %% Green: Implemented
    %% Orange: In Progress
    %% Red: Not Implemented
