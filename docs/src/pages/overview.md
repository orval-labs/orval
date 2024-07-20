---
id: overview
title: Overview
---

`orval` is able to generate client with appropriate type-signatures (TypeScript) from any valid OpenAPI v3 or Swagger v2 specification, either in `yaml` or `json` formats.

## Motivation

I often use a swagger as contract between the frontend and backend team. And before Orval, I used the <a href="https://editor.swagger.io" target="_blank">swagger editor</a> or <a href="https://swagger.io/tools/swagger-codegen" target="_blank">swagger codegen</a> but that wasn't enough for my need. That's why I started Orval.

Main goals:

- Generate typescript models
- Generate HTTP Calls
- Generate Mocks with <a href="https://mswjs.io/" target="_blank">MSW</a>

The default generated client use axios and can be used by fetch API or your favourite Javascript framework like Angular, React or Vue. It's just a function who takes an instance of axios or function of fetch API in argument and return an object where each key is a function who setup a call HTTP. [Learn more](./guides/basics)

Orval can also generate the following client:

- [React query with axios](./guides/react-query)
- [Angular with HttpClient](./guides/angular)
