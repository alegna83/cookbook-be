# Diagrams (PlantUML)

Ficheiros PlantUML com a arquitectura do sistema.

See also:

- docs/diagrams/diagram-explanations.md

Files:

- docs/diagrams/project-architecture.puml
- docs/diagrams/system-overview.puml
- docs/diagrams/frontend-architecture.puml
- docs/diagrams/deployment.puml
- docs/diagrams/communication-auth-flow.puml
- docs/diagrams/communication-accommodation-flow.puml
- docs/diagrams/communication-suggestions-flow.puml
- docs/diagrams/communication-media-moderation-flow.puml
- docs/diagrams/communication-contact-flow.puml
- docs/diagrams/communication-overview.puml
- docs/diagrams/component-auth-sessions.puml
- docs/diagrams/database-er-diagram.puml
- docs/diagrams/dataflow-pii-retention.puml
- docs/diagrams/sequence-add-comment.puml
- docs/diagrams/sequence-add-favorite.puml
- docs/diagrams/sequence-add-accommodation.puml
- docs/diagrams/sequence-upload-moderation.puml
- docs/diagrams/state-accommodation-lifecycle.puml

Rendered images:

- docs/diagrams/png/project-architecture.png
- docs/diagrams/png/system-overview.png
- docs/diagrams/png/frontend-architecture.png
- docs/diagrams/png/deployment.png
- docs/diagrams/png/communication-auth-flow.png
- docs/diagrams/png/communication-accommodation-flow.png
- docs/diagrams/png/communication-suggestions-flow.png
- docs/diagrams/png/communication-media-moderation-flow.png
- docs/diagrams/png/communication-contact-flow.png
- docs/diagrams/png/communication-overview.png
- docs/diagrams/png/component-auth-sessions.png
- docs/diagrams/png/database-er-diagram.png
- docs/diagrams/png/dataflow-pii-retention.png
- docs/diagrams/png/sequence-add-comment.png
- docs/diagrams/png/sequence-add-favorite.png
- docs/diagrams/png/sequence-add-accommodation.png
- docs/diagrams/png/sequence-upload-moderation.png
- docs/diagrams/png/state-accommodation-lifecycle.png

Render (opções):

- Usando Docker (recomendada se não tiver plantuml local):

```bash
docker run --rm -v "$(pwd)":/workspace -w /workspace plantuml/plantuml -tpng -o png docs/diagrams/*.puml
```

- Usando `plantuml.jar` (tem de ter Java e Graphviz instalados):

```bash
java -jar plantuml.jar -tpng -o png docs/diagrams/*.puml
```

- VSCode: instale a extensão "PlantUML" e abra os ficheiros `.puml` para pré-visualizar e exportar.

Notes:

- O antigo `backend-architecture.puml` foi descartado; o ficheiro atual de referência arquitetural é `project-architecture.puml`.
- Os diagramas são simples pontos de partida — podem ser expandidos para mais sequência, componentes detalhados, ou diagramas C4.
- Os diagramas de comunicação mostram o fluxo entre o frontend Flutter e os principais endpoints do backend NestJS.
