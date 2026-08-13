/**
 * Checklist da vistoria — 12 cards sequenciais (somente dados).
 */
(function vehicleEntryInspectionChecklistModule(global) {
  "use strict";

  function item(key, label) {
    return { key, label };
  }

  const INSPECTION_CARDS = [
    {
      id: "interno",
      title: "INTERNO",
      blocks: [
        {
          items: [
            item("interno_painel", "Painel"),
            item("interno_console", "Console"),
            item("interno_relogio", "Relógio"),
            item("interno_air_bag", "Air Bag"),
            item("interno_macaneta", "Maçaneta"),
            item("interno_tapetes", "Tapetes"),
            item("interno_bancos_altos", "Bancos — Altos"),
            item("interno_bancos_baixos", "Bancos — Baixos"),
            item("interno_revestimentos", "Revestimentos (Teto/Laterais)"),
            item("interno_cinto_seguranca", "Cinto de Segurança"),
            item("interno_macaco", "Macaco"),
            item("interno_chave_roda", "Chave de Roda"),
            item("interno_triangulo", "Triângulo"),
            item("interno_extintor", "Extintor"),
            item("interno_assoalho", "Assoalho"),
            item("interno_acendedor", "Acendedor"),
            item("interno_retrovisor", "Retrovisor"),
            item("interno_teto_solar", "Teto Solar"),
            item("interno_encosto_cabeca", "Encosto de Cabeça"),
          ],
        },
      ],
    },
    {
      id: "mecanica",
      title: "MECÂNICA",
      blocks: [
        {
          items: [
            item("mec_motor", "Motor"),
            item("mec_ignicao_eletronica", "Ignição Eletrônica"),
            item("mec_injecao_eletronica", "Injeção Eletrônica"),
            item("mec_carburador", "Carburador"),
            item("mec_bateria", "Bateria"),
            item("mec_bomba_injetora", "Bomba Injetora"),
            item("mec_radiador", "Radiador"),
            item("mec_motor_arranque", "Motor de Arranque"),
            item("mec_freios_pe_mao", "Freios (Pé/Mão)"),
            item("mec_bomba_ar_condicionado", "Bomba — Ar Condicionado"),
            item("mec_bomba_dir_hidraulica", "Bomba — Dir. Hidráulica"),
            item("mec_bomba_comb_eletronica", "Bomba — Comb. Eletrônica"),
            item("mec_bobina", "Bobina"),
            item("mec_embreagem", "Embreagem"),
            item("mec_cambio_4m", "Câmbio — 4M"),
            item("mec_cambio_5m", "Câmbio — 5M"),
            item("mec_cambio_aut", "Câmbio — Aut"),
          ],
        },
      ],
    },
    {
      id: "traseira",
      title: "TRASEIRA",
      blocks: [
        {
          items: [
            item("tras_tampa_traseira", "Tampa Traseira"),
            item("tras_macaneta", "Maçaneta"),
            item("tras_para_choque", "Para-Choque"),
            item("tras_limpador", "Limpador Tras."),
            item("tras_lanternas", "Lanternas"),
            item("tras_vidros", "Vidros"),
            item("tras_escapamento", "Escapamento"),
            item("tras_sala", "Sala"),
            item("tras_engate", "Engate"),
          ],
        },
      ],
    },
    {
      id: "equipamentos",
      title: "EQUIPAMENTOS / ACESSÓRIOS",
      blocks: [
        {
          items: [
            item("eq_radio", "Rádio"),
            item("eq_marca", "Marca"),
            item("eq_modelo", "Modelo"),
            item("eq_alto_falantes", "Alto Falantes"),
            item("eq_antena", "Antena"),
            item("eq_chave_veiculo", "Chave do Veículo"),
            item("eq_modulo_som", "Módulo de Som"),
            item("eq_kit_gas", "Kit Gás"),
            item("eq_buzina", "Buzina"),
            item("eq_alarme", "Alarme"),
            item("eq_banco_couro", "Banco de Couro"),
            item("eq_bagageiro_teto", "Bagageiro de Teto"),
            item("eq_para_sol", "Para-Sol"),
            item("eq_tacografo", "Tacógrafo"),
            item("eq_toca_fitas", "Toca Fitas"),
            item("eq_cd", "CD"),
            item("eq_qt", "QT"),
            item("eq_d", "D"),
            item("eq_t", "T"),
            item("eq_ext", "Ext."),
            item("eq_int", "Int."),
            item("eq_tampao", "Tampão"),
          ],
        },
      ],
    },
    {
      id: "dianteira",
      title: "DIANTEIRA",
      blocks: [
        {
          items: [
            item("dian_capo", "Capô"),
            item("dian_para_choque", "Para-Choque"),
            item("dian_limpadores", "Limpadores Para-Brisa"),
            item("dian_para_brisa", "Para-Brisa"),
            item("dian_farois", "Faróis"),
            item("dian_farois_aux", "Faróis Auxiliares"),
            item("dian_lanternas", "Lanternas"),
            item("dian_teto", "Teto"),
            item("dian_sala", "Sala"),
            item("dian_grade", "Grade"),
          ],
        },
      ],
    },
    {
      id: "lado_esquerdo",
      title: "LADO ESQUERDO",
      blocks: [
        {
          items: [
            item("lesq_para_lama_diant", "Para-Lama Dianteiro"),
            item("lesq_para_lama_tras", "Para-Lama Traseiro"),
            item("lesq_porta_diant", "Porta Dianteira"),
            item("lesq_porta_tras", "Porta Traseira"),
            item("lesq_macanetas", "Maçanetas"),
            item("lesq_macanetas_m", "Maçanetas — M"),
            item("lesq_macanetas_e", "Maçanetas — E"),
            item("lesq_retrovisor", "Retrovisor"),
            item("lesq_vidros", "Vidros"),
            item("lesq_friso", "Friso"),
          ],
        },
      ],
    },
    {
      id: "lado_direito",
      title: "LADO DIREITO",
      blocks: [
        {
          items: [
            item("ldir_para_lama_diant", "Para-Lama Dianteiro"),
            item("ldir_para_lama_tras", "Para-Lama Traseiro"),
            item("ldir_porta_diant", "Porta Dianteira"),
            item("ldir_porta_tras", "Porta Traseira"),
            item("ldir_macanetas", "Maçanetas"),
            item("ldir_macanetas_m", "Maçanetas — M"),
            item("ldir_macanetas_e", "Maçanetas — E"),
            item("ldir_retrovisor", "Retrovisor"),
            item("ldir_vidros", "Vidros"),
            item("ldir_friso", "Friso"),
          ],
        },
      ],
    },
    {
      id: "eixo",
      title: "QUANTIDADE DE EIXO",
      blocks: [
        {
          items: [
            item("eixo_toco", "Toco"),
            item("eixo_trucado", "Trucado"),
            item("eixo_3_trucado", "3º eixo Trucado"),
            item("eixo_outros", "Outros"),
          ],
        },
      ],
    },
    {
      id: "carroceria",
      title: "TIPO DE CARROCERIA",
      blocks: [
        {
          items: [
            item("car_bau_isotermico", "Baú Isotérmico"),
            item("car_graneleira", "Graneleira"),
            item("car_aberta", "Aberta"),
            item("car_cacamba", "Caçamba"),
            item("car_tanque", "Tanque"),
          ],
        },
      ],
    },
    {
      id: "rodas",
      title: "RODAS",
      blocks: [
        {
          items: [
            item("rod_pneu_dd", "Pneu D/Dir."),
            item("rod_pneu_de", "Pneu D/Esq."),
            item("rod_pneu_td", "Pneu T/Dir."),
            item("rod_pneu_te", "Pneu T/Esq."),
            item("rod_estepe_marca", "Estepe (Marca)"),
            item("rod_calotas", "Calotas"),
            item("rod_liga_leve_qtde", "Liga Leve — Qtde"),
          ],
        },
      ],
    },
    {
      id: "motos",
      title: "MOTOS",
      blocks: [
        {
          items: [
            item("moto_carenagem", "Carenagem"),
            item("moto_guidao", "Guidão"),
            item("moto_tanque", "Tanque"),
            item("moto_lateral", "Lateral"),
          ],
        },
        {
          items: [
            item("moto_setas", "Setas"),
            item("moto_pedaleira", "Pedaleira"),
            item("moto_freio_manete", "Freio Manete/Pedaleira"),
            item("moto_suporte_descanso", "Suporte de Descanso"),
          ],
        },
        {
          items: [
            item("moto_corrente", "Corrente"),
            item("moto_escapamento", "Escapamento"),
            item("moto_lanterna_traseira", "Lanterna Traseira"),
            item("moto_farol", "Farol"),
          ],
        },
      ],
    },
    {
      id: "tratores",
      title: "TRATORES E MÁQUINAS AGRÍCOLAS",
      blocks: [
        {
          items: [
            item("trat_pneus", "Pneus"),
            item("trat_eixo_diant_4x2", "Eixo Dianteiro 4X2"),
            item("trat_eixo_diant_4x4", "Eixo Dianteiro 4X4"),
            item("trat_embreagem", "Embreagem"),
            item("trat_cambio", "Câmbio"),
            item("trat_motor", "Motor"),
          ],
        },
        {
          title: "TIPO",
          items: [
            item("trat_dir_mecanica", "Direção Mecânica"),
            item("trat_dir_hidraulica", "Direção Hidráulica/Hidrostática"),
            item("trat_freios", "Freios"),
            item("trat_freios_umido", "Freios — Úmido"),
            item("trat_freios_seco", "Freios — Seco"),
            item("trat_eixo_traseiro", "Eixo Traseiro — Diferencial"),
            item("trat_lataria", "Lataria"),
            item("trat_pintura", "Pintura"),
          ],
        },
        {
          items: [
            item("trat_eletrica", "Elétrica"),
            item("trat_barra_tracao", "Barra de Tração"),
            item("trat_assento_operador", "Assento Operador"),
            item("trat_cabine", "Cabine"),
            item("trat_para_choque", "Para-Choque"),
            item("trat_bracos_hidraulicos", "Braços Hidráulicos"),
          ],
        },
      ],
    },
  ];

  const CHECKLIST = [];
  INSPECTION_CARDS.forEach((card) => {
    card.blocks.forEach((block) => {
      block.items.forEach((it) => {
        CHECKLIST.push({
          category: card.title,
          cardId: card.id,
          key: it.key,
          label: it.label,
          blockTitle: block.title || null,
        });
      });
    });
  });

  const INSPECTION_CHECKLIST_KEYS = CHECKLIST.map((it) => it.key);

  global.vehicleEntryInspectionChecklist = {
    INSPECTION_CARDS,
    CHECKLIST,
    INSPECTION_CHECKLIST_KEYS,
    CARD_COUNT: INSPECTION_CARDS.length,
    ITEM_COUNT: CHECKLIST.length,
  };
})(typeof window !== "undefined" ? window : globalThis);
