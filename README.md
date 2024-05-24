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
Modulos instalados -  axios, dotenv, ejs, express, nodemon, oracledb.

Configure o arquivo .env de acordo com o env.modelo.

# Configurações

Os arquivos de templates precisam ser ajustados com as IDs de acordo com o fluxo do Holmes, essas IDs são unicas por fluxo.
Assim como o start_event que é unico para cada endpoint.

- Hoje os updates para as tabelas estão hardcoded dentro da rota, é necessário ajusta-los para fazer o update na tabela auxiliar para evitar envio de processos repetidos.

# Implantação envio automático

Para iniciar o aplicativo web é utilizado o modulo PM2:

1. **Iniciar o Aplicativo**:
   ```sh
   pm2 start app.js --name "integrador"
   ```
2. **Verificar Lista do PM2**:
   ```sh
    pm2 list
   ```
3. **Configurar PM2 para Iniciar no Boot**:
   ```sh
    pm2 startup
   ```
4. **Salvar a Lista de Processos do PM2**:
   ```sh
    pm2 save
   ```
5. **Visualizar Logs**:
   ```sh
    pm2 logs integrador
   ```

## TO-DO
## Fluxo Pgto - Despesas

- **NF de Origem: Quando se tratar de frete, verificar a NF de origem no Apollo e ajustar a query conforme necessário.
- **Conta / Descrição: Atualizar o nome no Holmes para refletir corretamente como uma descrição livre, dado que já existe uma observação.
- **Chassi: Determinar onde esses dados estão armazenados no Apollo.
- **Tipo de Pagamento: Alterar para tipo de transação no Holmes.

## Fluxo Pgto RH - (Pgto PJ)

- **Verificar transações para criar uma rota com os dados.

## Fluxo Faturamento

- **Divisão por Tipo de Veículo: Determinar como dividir pelo tipo de veículo (seminovo, novo, frotista).
- **Formas de Pagamento: Verificar e mapear formas de pagamento entre Apollo e Holmes.
- **Cortesia: Incluir cortesia no fluxo.
- **Falta de Dados do Cliente: Determinar como lidar com casos em que faltam dados do cliente.

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](LICENSE.md) para mais detalhes.

## Contato

Para qualquer pergunta ou sugestão, entre em contato com [Robson Scartezini](mailto:robsonshk@gmail.com).
