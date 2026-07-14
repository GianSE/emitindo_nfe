CREATE TABLE "fornecedores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cnpj" text NOT NULL,
	"nome" text,
	"criado_em" timestamp with time zone DEFAULT now(),
	CONSTRAINT "fornecedores_cnpj_unique" UNIQUE("cnpj")
);
--> statement-breakpoint
CREATE TABLE "venda_itens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venda_id" uuid NOT NULL,
	"produto_cod" text,
	"qtd" numeric(14, 4) NOT NULL,
	"preco_unit" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "produtos" ALTER COLUMN "saldo" SET DATA TYPE numeric(14, 4);--> statement-breakpoint
ALTER TABLE "produtos" ALTER COLUMN "saldo" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "produtos" ALTER COLUMN "preco" SET DATA TYPE numeric(14, 2);--> statement-breakpoint
ALTER TABLE "produtos" ALTER COLUMN "preco" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "titulos" ALTER COLUMN "valor" SET DATA TYPE numeric(14, 2);--> statement-breakpoint
ALTER TABLE "notas_entrada" ADD COLUMN "fornecedor_id" uuid;--> statement-breakpoint
ALTER TABLE "titulos" ADD COLUMN "nota_id" uuid;--> statement-breakpoint
ALTER TABLE "vendas" ADD COLUMN "cliente_id" uuid;--> statement-breakpoint
ALTER TABLE "venda_itens" ADD CONSTRAINT "venda_itens_venda_id_vendas_id_fk" FOREIGN KEY ("venda_id") REFERENCES "public"."vendas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venda_itens" ADD CONSTRAINT "venda_itens_produto_cod_produtos_cod_fk" FOREIGN KEY ("produto_cod") REFERENCES "public"."produtos"("cod") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_venda_itens_venda" ON "venda_itens" USING btree ("venda_id");--> statement-breakpoint
ALTER TABLE "notas_entrada" ADD CONSTRAINT "notas_entrada_fornecedor_id_fornecedores_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_venda_id_vendas_id_fk" FOREIGN KEY ("venda_id") REFERENCES "public"."vendas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titulos" ADD CONSTRAINT "titulos_nota_id_notas_fiscais_id_fk" FOREIGN KEY ("nota_id") REFERENCES "public"."notas_fiscais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notas_status" ON "notas_fiscais" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_outbox_status" ON "outbox" USING btree ("status","disponivel_em");--> statement-breakpoint
CREATE INDEX "idx_titulos_nota" ON "titulos" USING btree ("nota_id");--> statement-breakpoint
CREATE INDEX "idx_titulos_status_venc" ON "titulos" USING btree ("status","vencimento");--> statement-breakpoint
CREATE INDEX "idx_vendas_cliente" ON "vendas" USING btree ("cliente_id");--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_venda_id_unique" UNIQUE("venda_id");--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_chave_unique" UNIQUE("chave");