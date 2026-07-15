# Explicação dos diagramas

Este documento resume o propósito de cada diagrama criado para o projecto Stays4Pilgrims. A intenção é ajudar a justificar a arquitectura na tese e mostrar como as peças principais do sistema se relacionam.

## 1. system-overview.puml

Mostra a visão geral do sistema em alto nível: utilizador, frontend, backend e base de dados. O objectivo é dar uma leitura rápida da arquitectura global sem entrar em detalhes internos.

Este diagrama é útil na tese para introduzir o sistema antes de detalhar os fluxos específicos. Serve como mapa inicial da solução.

## 2. project-architecture.puml

Representa a arquitectura funcional do sistema Stays4Pilgrims. Destaca os principais módulos do backend NestJS, os serviços externos e as dependências entre frontend, backend, base de dados, moderação, upload, contacto e email.

Este diagrama justifica a divisão por responsabilidades. Em vez de concentrar toda a lógica num único bloco, o backend é organizado por módulos para facilitar manutenção, evolução e teste.

## 3. frontend-architecture.puml

Mostra a estrutura interna do frontend Stays4Pilgrims, incluindo interface, estado e cliente de API.

Este diagrama é útil para explicar como a aplicação Flutter separa a camada de apresentação da camada de comunicação com o backend. Na tese, ajuda a demonstrar que o frontend não faz lógica de negócio pesada localmente; depende do backend para operações principais.

## 4. deployment.puml

Descreve o contexto de deployment: utilizador, navegador/dispositivo móvel, CDN/servidor de frontend, backend e base de dados.

Este diagrama é importante para mostrar como a solução é disponibilizada em ambiente real. Ajuda a justificar decisões de distribuição, como a separação entre assets estáticos e API.

## 5. communication-overview.puml

É o diagrama-resumo da comunicação entre frontend e backend. Resume as áreas principais de interação: autenticação, pesquisa de alojamentos, comentários, favoritos, sugestões, uploads, actualização de conta, contacto e moderação.

Este diagrama funciona bem como ponte entre a visão geral e os fluxos detalhados. Na tese, é útil para mostrar que a aplicação depende de vários ciclos de troca de dados, mas sem repetir todos os endpoints.

## 6. communication-auth-flow.puml

Explica a comunicação relacionada com autenticação e conta: registo, login, verificação de email, pedido de recuperação de password e alteração de password.

Este fluxo justifica o uso de serviços separados para autenticação, contas e email. Também evidencia a presença de validação do utilizador através de tokens e JWT.

## 7. communication-accommodation-flow.puml

Mostra o fluxo de consulta de alojamentos e comentários: listar alojamentos, filtrar por caminho, abrir detalhe, listar comentários, verificar se já houve comentário e obter estatísticas.

Este diagrama é útil para justificar a natureza orientada a conteúdo da aplicação, em que o frontend consulta várias rotas do backend para montar uma vista completa do alojamento.

## 8. communication-suggestions-flow.puml

Mostra o fluxo das sugestões contextuais e da recomendação do melhor alojamento. Explica como o frontend envia coordenadas e interesse, como o backend cruza dados locais com IA e como devolve sugestões e recomendações enriquecidas.

Este diagrama é útil porque esta funcionalidade já tem impacto direto na experiência web e móvel, e combina dados persistidos com análise externa.

## 9. communication-media-moderation-flow.puml

Descreve a comunicação ligada a media e moderação: upload de imagens, actualização de avatar, contribuição de fotos para alojamentos e aprovação/rejeição de conteúdos.

Este diagrama reforça a decisão de separar envio de ficheiros, persistência e moderação. Na tese, ajuda a explicar como o sistema suporta contributos dos utilizadores com controlo de qualidade.

## 10. communication-contact-flow.puml

Mostra o envio de mensagens através da página Contact Us. Inclui validação no backend, encaminhamento para o serviço de email e o cenário de falha quando a entrega está desactivada por configuração.

Este diagrama é importante porque a funcionalidade de contacto já faz parte do produto e transporta dados pessoais, apesar de não persistir a mensagem na base de dados.

## 11. component-auth-sessions.puml

Detalha o fluxo técnico de autenticação, geração de JWT e validação das sessões. É mais técnico do que o diagrama `communication-auth-flow.puml` e serve melhor para explicar a camada de segurança.

## 12. database-er-diagram.puml

Representa uma versão simplificada das entidades principais da base de dados e das relações efetivamente relevantes para os fluxos atuais do backend. Foca-se nos identificadores, ownership, estado de moderação, pedidos e relações funcionais mais importantes.

## 13. dataflow-pii-retention.puml

Mostra onde circulam e ficam dados pessoais, incluindo autenticação, contacto, comentários, fotos e emails. Este diagrama é particularmente útil para discutir retenção, privacidade e responsabilidades de tratamento.

## 14. sequence-add-comment.puml

Mostra o fluxo detalhado de criação de comentários, incluindo moderação e persistência em estado pendente.

## 15. sequence-add-favorite.puml

Mostra o comportamento de toggle dos favoritos e a simplicidade do fluxo entre frontend, controller, service e base de dados.

## 16. sequence-add-accommodation.puml

Detalha a criação de novos alojamentos, incluindo imagens, moderação e persistência.

## 17. sequence-upload-moderation.puml

Mostra o processo técnico de upload com verificação de moderação antes e depois da publicação do ficheiro.

## 18. state-accommodation-lifecycle.puml

Representa o ciclo de vida de um alojamento ou contributo, desde draft ou pending até approved, rejected, published e archived.

## Como usar estes diagramas na tese

- Usa o diagrama-resumo para apresentar a arquitectura geral.
- Usa os diagramas internos para justificar a modularidade do frontend e do backend.
- Usa os diagramas de comunicação para explicar os casos de uso mais relevantes.
- Inclui as imagens PNG quando quiseres evidência visual na secção de arquitectura.

## Localização dos ficheiros

- PlantUML: `docs/diagrams/*.puml`
- Imagens exportadas: `docs/diagrams/png/*.png`
