-- Create table
create table AD_FAT_HOLMES
(
  STATUS_LANC_HOLMES VARCHAR2(1) default 'N' not null,
  REQUISICAO         VARCHAR2(100),
  EMPRESA            NUMBER not null,
  REVENDA            NUMBER not null,
  ESTABELECIMENTO    VARCHAR2(14),
  VEICULO            VARCHAR2(20),
  NOME_CLIENTE       VARCHAR2(255),
  CNPJ_CPF           VARCHAR2(200),
  EMAIL              VARCHAR2(255),
  TELEFONE           VARCHAR2(20),
  TIPO_PESSOA        VARCHAR2(20),
  PROPOSTA           NUMBER not null,
  CHASSI             VARCHAR2(255),
  USADO_TROCA        VARCHAR2(1),
  FORMA_PAGAMENTO    VARCHAR2(50),
  CORTESIA           VARCHAR2(50),
  OBSERVACAO         VARCHAR2(4000),
  DATA_LANC_HOLMES   DATE,
  CLIENTE            NUMBER,
  LICITACAO          NUMBER,
  REPASSE            NUMBER,
  RESPONSAVEL        VARCHAR2(50),
  REFATURAMENTO      NUMBER
)

-- Add comments to the columns 
comment on column AD_FAT_HOLMES.STATUS_LANC_HOLMES
  is 'Status do lançamento no holmes, default N para enviar após inserção';
comment on column AD_FAT_HOLMES.REQUISICAO
  is 'Numero da requisicao gerada no envio para o Holmes (interna somente)';
comment on column AD_FAT_HOLMES.ESTABELECIMENTO
  is 'CNPJ da empresa/revenda para de-para com ID do holmes';
comment on column AD_FAT_HOLMES.USADO_TROCA
  is 'Verifica cond pagto 140, se tem = S ';
comment on column AD_FAT_HOLMES.CORTESIA
  is 'Cortesia sempre null';
comment on column AD_FAT_HOLMES.OBSERVACAO
  is 'Observação da proposta, convertida de CLOB pra txt';
comment on column AD_FAT_HOLMES.DATA_LANC_HOLMES
  is 'Data de envio Holmes';
comment on column AD_FAT_HOLMES.CLIENTE
  is 'Cliente para validação de financeiro';
comment on column AD_FAT_HOLMES.LICITACAO
  is 'Se tem forma_pgto licitacao';
comment on column AD_FAT_HOLMES.REPASSE
  is 'Se vendendor é repasse';
comment on column AD_FAT_HOLMES.RESPONSAVEL
  is 'Responsavel Apollo x Holmes';
comment on column AD_FAT_HOLMES.REFATURAMENTO
  is 'Se veiculo tem modelo começando por REFAT';