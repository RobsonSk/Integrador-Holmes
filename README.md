# Integração Apollo ERP para Holmes

## Overview

Este aplicativo web em Node.js realiza a comunicação de lançamentos de Despesas e propostas do ERP Apollo para os fluxos especifícos no Holmes. Ele monitora e processa alterações, enviando dados relevantes para a plataforma Holmes com base em critérios específicos solicitados pela concessionária.

## Funcionalidades

- **Procedures de Banco de Dados**: Acompanha alterações e grava em tabelas auxiliares no banco de dados Oracle.
- **Processamento Automático**: Utiliza `node-cron` para verificar alterações e processá-las automaticamente.
- **Comunicação com API**: Envia dados para a plataforma Holmes usando rotas predefinidas com base nas tabelas auxiliares.

## Como Funciona

1. **Monitoramento do Banco de Dados**: O aplicativo monitora as tabelas auxiliares para alterações na qual o status seja 'N'.
2. **Processamento Baseado em Rotas**: Com base na tabela, envia dados para a rota apropriada na plataforma Holmes.
3. **Agendamento Automático**: Utiliza `node-cron` para executar verificações e envios em intervalos regulares.

## Configuração e Implantação

# Modulos necessários

Para instalar os modulos necessários navegue até a pasta raiz e digite:

```sh
npm install
```

Modulos instalados - axios, dotenv, ejs, express, nodemon, oracledb.

Configure o arquivo .env de acordo com o env.modelo.

# Configurações

Os arquivos de templates precisam ser ajustados com as IDs de acordo com o fluxo do Holmes, essas IDs são unicas por fluxo.
Assim como o start_event que é unico para cada endpoint.

- Hoje os updates para as tabelas estão hardcoded dentro da rota, é necessário ajusta-los para fazer o update na tabela auxiliar para evitar envio de processos repetidos.

# Implantação envio automático

Para iniciar o aplicativo web é utilizado o modulo PM2:

1. **Instalar o PM2**:
   ```sh
   npm install pm2 -g
   ```

2. **Iniciar o Aplicativo**:
   ```sh
   pm2 start app.js --name "integrador"
   ```
3. **Verificar Lista do PM2**:
   ```sh
    pm2 list
   ```
4. **Configurar PM2 para Iniciar no Boot**:
   ```sh
    pm2 startup
   ```
5. **Salvar a Lista de Processos do PM2**:
   ```sh
    pm2 save
   ```
6. **Visualizar Logs**:
   ```sh
    pm2 logs integrador
   ```


## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](./LICENSE.md) para mais detalhes.

## Contato

Para qualquer pergunta ou sugestão, entre em contato com [Robson Scartezini](mailto:robsonshk@gmail.com).
