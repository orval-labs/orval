---
id: overview
title: Overview
---

`orval` is able to generate client with appropriate type-signatures (TypeScript) from any valid OpenAPI v3 or Swagger v2 specification, either in `yaml` or `json` formats.

## Motivation

I often use a swagger as contract between the frontend and backend team. And before orval, I used the <a href="editor.swagger.io" target="_blank">swagger editor</a> or <a href="https://swagger.io/tools/swagger-codegen" target="_blank">swagger codegen</a> but that wasn't enough for my need. That's why I started orval.

Main goals:

- Generate typescript models
- Generate HTTP Calls
- Generate Mocks with <a href="https://mswjs.io/" target="_blank">MSW</a>

The default generated client use axios and can be used by your favourite Javascript framework like angular, react or vue. It's just a function who takes an instance of axios in argument and return an object where each key is a function who setup a call HTTP. [Learn more](./guides/basics)

orval can also generate the following client:

- [React query with axios](./guides/react-query)
- [Angular with HttpClient](./guides/angular)
