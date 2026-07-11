CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"doc" text,
	"logradouro" text,
	"numero" text,
	"bairro" text,
	"cod_municipio" text,
	"municipio" text,
	"uf" text,
	"cep" text,
	"ind_ie_dest" text DEFAULT '9',
	"criado_em" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "configuracoes" (
	"chave" text PRIMARY KEY NOT NULL,
	"valor" jsonb NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consumidores" (
	"nome" text PRIMARY KEY NOT NULL,
	"ultimo_id" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dfe_cursor" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"ult_nsu" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"payload" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notas_entrada" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nsu" bigint,
	"chave" text,
	"cnpj_emitente" text,
	"xml" "bytea",
	"itens" jsonb,
	"manifestacao" text,
	"recebida_em" timestamp with time zone DEFAULT now(),
	CONSTRAINT "notas_entrada_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
CREATE TABLE "notas_fiscais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venda_id" uuid NOT NULL,
	"serie" integer,
	"numero" bigint,
	"cnf" text,
	"chave" text,
	"status" text DEFAULT 'pendente' NOT NULL,
	"cstat" text,
	"motivo" text,
	"nprot" text,
	"xml_autorizado" "bytea",
	"armazenado" boolean DEFAULT false NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"atualizada_em" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "numeracao" (
	"serie" integer PRIMARY KEY NOT NULL,
	"proximo_numero" bigint DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"disponivel_em" timestamp with time zone DEFAULT now() NOT NULL,
	"processando_desde" timestamp with time zone,
	"ultimo_erro" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produtos" (
	"cod" text PRIMARY KEY NOT NULL,
	"nome" text,
	"saldo" numeric DEFAULT '0' NOT NULL,
	"ncm" text,
	"cfop" text,
	"unidade" text DEFAULT 'UN',
	"preco" numeric DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "titulos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"origem_chave" text,
	"descricao" text,
	"valor" numeric NOT NULL,
	"parcela" integer DEFAULT 1 NOT NULL,
	"total_parcelas" integer DEFAULT 1 NOT NULL,
	"vencimento" date,
	"status" text DEFAULT 'aberto' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"senha_hash" text NOT NULL,
	"nome" text,
	"papel" text DEFAULT 'operador' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now(),
	CONSTRAINT "usuarios_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vendas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente" jsonb,
	"itens" jsonb,
	"opcoes" jsonb DEFAULT '{}'::jsonb,
	"criada_em" timestamp with time zone DEFAULT now()
);
