---
id: overview
title: Overview
---

`orval` is able to generate client with appropriate type-signatures (TypeScript) from any valid OpenAPI v3 or Swagger v2 specification, either in `yaml` or `json` formats.

## Motivation

I often use a swagger as contract between the frontend and backend team. And before orval, I used the [swagger editor](editor.swagger.io) or [swagger codegen](https://swagger.io/tools/swagger-codegen) but that wasn't enough for my need. That's why I started orval.

Main goals:

- Generate typescript models
- Generate HTTP Calls
- Generate Mocks with [MSW](https://mswjs.io/)

The default generated client use axios and can be use by your favorite Javascript framework like angular, react or vue. It's just a function who take an instance of axios in argument and return an object where each key is function who setup a call http. [Learn more](./guides/basics)

orval can also generate the following client:

- [React query with axios](./guides/react-query)
- [Angular with HttpClient](./guides/angular)
