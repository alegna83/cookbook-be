# Diagrams (PlantUML)

Ficheiros PlantUML com a arquitectura do sistema.

See also:

- docs/diagrams/diagram-explanations.md

Files:

- docs/diagrams/system-overview.puml
- docs/diagrams/backend-architecture.puml
- docs/diagrams/frontend-architecture.puml
- docs/diagrams/deployment.puml
- docs/diagrams/communication-auth-flow.puml
- docs/diagrams/communication-accommodation-flow.puml
- docs/diagrams/communication-media-moderation-flow.puml
- docs/diagrams/communication-overview.puml

Rendered images:

- docs/diagrams/png/system-overview.png
- docs/diagrams/png/backend-architecture.png
- docs/diagrams/png/frontend-architecture.png
- docs/diagrams/png/deployment.png
- docs/diagrams/png/communication-auth-flow.png
- docs/diagrams/png/communication-accommodation-flow.png
- docs/diagrams/png/communication-media-moderation-flow.png
- docs/diagrams/png/communication-overview.png

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

- O frontend código está em `/Users/angelaantunes/Documents/tese/camino_places_app` (usado nos diagramas).
- Os diagramas são simples pontos de partida — posso expandir para sequência, componentes detalhados, ou diagramas C4 se preferires.
- Os diagramas de comunicação mostram o fluxo entre o frontend Flutter e os principais endpoints do backend NestJS.
