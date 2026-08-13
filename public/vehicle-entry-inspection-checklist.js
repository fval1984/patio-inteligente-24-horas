/**
 * Checklist da vistoria — 4 modalidades independentes (somente dados).
 */
(function vehicleEntryInspectionChecklistModule(global) {
  "use strict";

  function cls(key, label, opts) {
    return { key, label, kind: "classify", ...(opts || {}) };
  }
  function txt(key, label, placeholder) {
    return { key, label, kind: "text", placeholder: placeholder || "" };
  }

  const DIAGRAMS = {
    LEVE: "/vehicle-inspection-diagram-4v.webp",
    PESADOS: "/vehicle-inspection-diagram-pesados.webp",
    TRATORES: "/vehicle-inspection-diagram-tratores.webp",
    MOTOS: "/vehicle-inspection-diagram-motos.webp",
  };

  const LEVE_CARDS = [
    {
      id: "interno",
      title: "INTERNO",
      blocks: [
        {
          items: [
            cls("interno_painel", "Painel"),
            cls("interno_console", "Console"),
            cls("interno_relogio", "Relógio"),
            cls("interno_air_bag", "Air Bag"),
            cls("interno_macaneta", "Maçaneta"),
            cls("interno_tapetes", "Tapetes"),
            cls("interno_bancos_altos", "Bancos — Altos"),
            cls("interno_bancos_baixos", "Bancos — Baixos"),
            cls("interno_revestimentos", "Revestimentos (Teto/Laterais)"),
            cls("interno_cinto_seguranca", "Cinto de Segurança"),
            cls("interno_macaco", "Macaco"),
            cls("interno_chave_roda", "Chave de Roda"),
            cls("interno_triangulo", "Triângulo"),
            cls("interno_extintor", "Extintor"),
            cls("interno_assoalho", "Assoalho"),
            cls("interno_acendedor", "Acendedor"),
            cls("interno_retrovisor", "Retrovisor"),
            cls("interno_teto_solar", "Teto Solar"),
            cls("interno_encosto_cabeca", "Encosto de Cabeça"),
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
            cls("mec_motor", "Motor"),
            cls("mec_ignicao_eletronica", "Ignição Eletrônica"),
            cls("mec_injecao_eletronica", "Injeção Eletrônica"),
            cls("mec_carburador", "Carburador"),
            cls("mec_bateria", "Bateria"),
            cls("mec_bomba_injetora", "Bomba Injetora"),
            cls("mec_radiador", "Radiador"),
            cls("mec_motor_arranque", "Motor de Arranque"),
            cls("mec_freios_pe_mao", "Freios (Pé/Mão)"),
            cls("mec_bomba_ar_condicionado", "Bomba — Ar Condicionado"),
            cls("mec_bomba_dir_hidraulica", "Bomba — Dir. Hidráulica"),
            cls("mec_bomba_comb_eletronica", "Bomba — Comb. Eletrônica"),
            cls("mec_bobina", "Bobina"),
            cls("mec_embreagem", "Embreagem"),
            cls("mec_cambio_4m", "Câmbio — 4M"),
            cls("mec_cambio_5m", "Câmbio — 5M"),
            cls("mec_cambio_aut", "Câmbio — Aut"),
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
            cls("tras_tampa_traseira", "Tampa Traseira"),
            cls("tras_macaneta", "Maçaneta"),
            cls("tras_para_choque", "Para-Choque"),
            cls("tras_limpador", "Limpador Tras."),
            cls("tras_lanternas", "Lanternas"),
            cls("tras_vidros", "Vidros"),
            cls("tras_escapamento", "Escapamento"),
            cls("tras_sala", "Sala"),
            cls("tras_engate", "Engate"),
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
            cls("eq_radio", "Rádio"),
            txt("eq_marca", "Marca"),
            txt("eq_modelo", "Modelo"),
            cls("eq_alto_falantes", "Alto Falantes", { numberKey: "eq_alto_falantes_qtd", numberLabel: "Quantidade" }),
            cls("eq_antena", "Antena"),
            cls("eq_chave_veiculo", "Chave do Veículo"),
            cls("eq_modulo_som", "Módulo de Som"),
            cls("eq_kit_gas", "Kit Gás"),
            cls("eq_buzina", "Buzina"),
            cls("eq_alarme", "Alarme"),
            cls("eq_banco_couro", "Banco de Couro"),
            cls("eq_bagageiro_teto", "Bagageiro de Teto"),
            cls("eq_para_sol", "Para-Sol"),
            cls("eq_tacografo", "Tacógrafo"),
            cls("eq_toca_fitas", "Toca Fitas"),
            cls("eq_cd", "CD"),
            cls("eq_tampao", "Tampão"),
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
            cls("dian_capo", "Capô"),
            cls("dian_para_choque", "Para-Choque"),
            cls("dian_limpadores", "Limpadores Para-Brisa"),
            cls("dian_para_brisa", "Para-Brisa"),
            cls("dian_farois", "Faróis"),
            cls("dian_farois_aux", "Faróis Auxiliares"),
            cls("dian_lanternas", "Lanternas"),
            cls("dian_teto", "Teto"),
            cls("dian_sala", "Sala"),
            cls("dian_grade", "Grade"),
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
            cls("lesq_para_lama_diant", "Para-Lama Dianteiro"),
            cls("lesq_para_lama_tras", "Para-Lama Traseiro"),
            cls("lesq_porta_diant", "Porta Dianteira"),
            cls("lesq_porta_tras", "Porta Traseira"),
            cls("lesq_macaneta", "Maçaneta"),
            cls("lesq_retrovisor", "Retrovisor"),
            cls("lesq_vidros", "Vidros"),
            cls("lesq_friso", "Friso"),
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
            cls("ldir_para_lama_diant", "Para-Lama Dianteiro"),
            cls("ldir_para_lama_tras", "Para-Lama Traseiro"),
            cls("ldir_porta_diant", "Porta Dianteira"),
            cls("ldir_porta_tras", "Porta Traseira"),
            cls("ldir_macaneta", "Maçaneta"),
            cls("ldir_retrovisor", "Retrovisor"),
            cls("ldir_vidros", "Vidros"),
            cls("ldir_friso", "Friso"),
          ],
        },
      ],
    },
    {
      id: "rodas",
      title: "RODAS",
      blocks: [
        {
          textFields: [
            txt("rod_pneu_referencia", "Referência do pneu", "175/70 R13"),
            txt("rod_pneu_marca", "Marca"),
          ],
          items: [
            cls("rod_pneu_dd", "Pneu D/Dir."),
            cls("rod_pneu_de", "Pneu D/Esq."),
            cls("rod_pneu_td", "Pneu T/Dir."),
            cls("rod_pneu_te", "Pneu T/Esq."),
            cls("rod_estepe", "Estepe"),
            cls("rod_calotas", "Calotas"),
            cls("rod_liga_leve", "Liga Leve"),
          ],
        },
      ],
    },
  ];

  const EIXO_CARD = {
    id: "eixo",
    title: "QUANTIDADE DE EIXO",
    blocks: [
      {
        items: [
          cls("eixo_toco", "Toco"),
          cls("eixo_trucado", "Trucado"),
          cls("eixo_3_trucado", "3º eixo Trucado"),
          cls("eixo_outros", "Outros"),
        ],
      },
    ],
  };

  const CARROCERIA_CARD = {
    id: "carroceria",
    title: "TIPO DE CARROCERIA",
    blocks: [
      {
        items: [
          cls("car_bau_isotermico", "Baú Isotérmico"),
          cls("car_graneleira", "Graneleira"),
          cls("car_aberta", "Aberta"),
          cls("car_cacamba", "Caçamba"),
          cls("car_tanque", "Tanque"),
        ],
      },
    ],
  };

  const MOTOS_CARDS = [
    {
      id: "motos",
      title: "MOTOS",
      blocks: [
        {
          items: [
            cls("moto_carenagem", "Carenagem"),
            cls("moto_guidao", "Guidão"),
            cls("moto_tanque", "Tanque"),
            cls("moto_lateral", "Lateral"),
          ],
        },
        {
          items: [
            cls("moto_setas", "Setas"),
            cls("moto_pedaleira", "Pedaleira"),
            cls("moto_freio_manete", "Freio Manete/Pedaleira"),
            cls("moto_suporte_descanso", "Suporte de Descanso"),
          ],
        },
        {
          items: [
            cls("moto_corrente", "Corrente"),
            cls("moto_escapamento", "Escapamento"),
            cls("moto_lanterna_traseira", "Lanterna Traseira"),
            cls("moto_farol", "Farol"),
          ],
        },
      ],
    },
  ];

  const TRATORES_CARDS = [
    {
      id: "tratores",
      title: "TRATORES E MÁQUINAS AGRÍCOLAS",
      blocks: [
        {
          items: [
            cls("trat_pneus", "Pneus"),
            cls("trat_eixo_diant_4x2", "Eixo Dianteiro 4X2"),
            cls("trat_eixo_diant_4x4", "Eixo Dianteiro 4X4"),
            cls("trat_embreagem", "Embreagem"),
            cls("trat_cambio", "Câmbio"),
            cls("trat_motor", "Motor"),
          ],
        },
        {
          title: "TIPO",
          items: [
            cls("trat_dir_mecanica", "Direção Mecânica"),
            cls("trat_dir_hidraulica", "Direção Hidráulica/Hidrostática"),
            cls("trat_freios", "Freios"),
            cls("trat_freios_umido", "Freios — Úmido"),
            cls("trat_freios_seco", "Freios — Seco"),
            cls("trat_eixo_traseiro", "Eixo Traseiro — Diferencial"),
            cls("trat_lataria", "Lataria"),
            cls("trat_pintura", "Pintura"),
          ],
        },
        {
          items: [
            cls("trat_eletrica", "Elétrica"),
            cls("trat_barra_tracao", "Barra de Tração"),
            cls("trat_assento_operador", "Assento Operador"),
            cls("trat_cabine", "Cabine"),
            cls("trat_para_choque", "Para-Choque"),
            cls("trat_bracos_hidraulicos", "Braços Hidráulicos"),
          ],
        },
      ],
    },
  ];

  const PESADOS_CARDS = [...LEVE_CARDS, EIXO_CARD, CARROCERIA_CARD];

  const VARIANT_META = {
    LEVE: {
      id: "LEVE",
      label: "Vistoria Leve",
      shortLabel: "Leve",
      description: "Carros de passeio, veículos leves e pequenas vans.",
      diagram: DIAGRAMS.LEVE,
      photoProfile: "LEVE",
      ready: true,
    },
    PESADOS: {
      id: "PESADOS",
      label: "Vistoria Pesados",
      shortLabel: "Pesados",
      description: "Vans maiores, ônibus, caminhões, carretas e veículos pesados.",
      diagram: DIAGRAMS.PESADOS,
      photoProfile: "PESADOS",
      ready: true,
    },
    TRATORES: {
      id: "TRATORES",
      label: "Tratores e Máquinas Agrícolas",
      shortLabel: "Tratores / Máquinas",
      description: "Tratores, máquinas e equipamentos agrícolas.",
      diagram: DIAGRAMS.TRATORES,
      photoProfile: "TRATORES",
      ready: true,
    },
    MOTOS: {
      id: "MOTOS",
      label: "Vistoria Motos",
      shortLabel: "Motos",
      description: "Motocicletas e motos.",
      diagram: DIAGRAMS.MOTOS,
      photoProfile: "MOTOS",
      ready: true,
    },
  };

  const VARIANT_CARDS = {
    LEVE: LEVE_CARDS,
    PESADOS: PESADOS_CARDS,
    TRATORES: TRATORES_CARDS,
    MOTOS: MOTOS_CARDS,
  };

  function flattenCards(cards) {
    const checklist = [];
    cards.forEach((card) => {
      card.blocks.forEach((block) => {
        (block.textFields || []).forEach((it) => {
          checklist.push({
            category: card.title,
            cardId: card.id,
            key: it.key,
            label: it.label,
            kind: it.kind,
            blockTitle: block.title || null,
          });
        });
        block.items.forEach((it) => {
          checklist.push({
            category: card.title,
            cardId: card.id,
            key: it.key,
            label: it.label,
            kind: it.kind || "classify",
            numberKey: it.numberKey || null,
            numberLabel: it.numberLabel || null,
            blockTitle: block.title || null,
          });
          if (it.numberKey) {
            checklist.push({
              category: card.title,
              cardId: card.id,
              key: it.numberKey,
              label: it.numberLabel || "Quantidade",
              kind: "number",
              parentKey: it.key,
              blockTitle: block.title || null,
            });
          }
        });
      });
    });
    return checklist;
  }

  function classifyKeysFromCards(cards) {
    return flattenCards(cards)
      .filter((it) => it.kind === "classify")
      .map((it) => it.key);
  }

  function getVariantConfig(variantId) {
    const id = String(variantId || "LEVE").toUpperCase();
    const meta = VARIANT_META[id] || VARIANT_META.LEVE;
    const cards = VARIANT_CARDS[id] || VARIANT_CARDS.LEVE;
    const checklist = flattenCards(cards);
    return {
      ...meta,
      cards,
      checklist,
      classifyKeys: classifyKeysFromCards(cards),
      cardCount: cards.length,
      itemCount: checklist.filter((it) => it.kind === "classify").length,
    };
  }

  const LEVE_CONFIG = getVariantConfig("LEVE");

  global.vehicleEntryInspectionChecklist = {
    INSPECTION_VARIANTS: Object.values(VARIANT_META),
    VARIANT_META,
    getVariantConfig,
    getDiagramSrc(variantId) {
      return getVariantConfig(variantId).diagram;
    },
    getVariantLabel(variantId) {
      return getVariantConfig(variantId).label;
    },
    /** Legado — espelha Vistoria Leve */
    INSPECTION_CARDS: LEVE_CONFIG.cards,
    CHECKLIST: LEVE_CONFIG.checklist,
    INSPECTION_CHECKLIST_KEYS: LEVE_CONFIG.classifyKeys,
    CARD_COUNT: LEVE_CONFIG.cardCount,
    ITEM_COUNT: LEVE_CONFIG.itemCount,
    LEVE_PHOTO_SLOTS: [
      { key: "diag_front_left", category: "EXTERIOR", label: "Dianteira diagonal esquerda" },
      { key: "diag_front_right", category: "EXTERIOR", label: "Dianteira diagonal direita" },
      { key: "side_left", category: "EXTERIOR", label: "Lateral esquerda" },
      { key: "side_right", category: "EXTERIOR", label: "Lateral direita" },
      { key: "diag_rear_right", category: "EXTERIOR", label: "Diagonal traseira direita" },
      { key: "diag_rear_left", category: "EXTERIOR", label: "Diagonal traseira esquerda" },
      { key: "roof", category: "EXTERIOR", label: "Teto" },
      { key: "dashboard_on", category: "INTERIOR", label: "Painel de instrumentos com o veículo ligado" },
      { key: "engine", category: "MECANICA", label: "Motor" },
      { key: "chassis", category: "IDENTIFICACAO", label: "Chassi" },
      { key: "battery", category: "MECANICA", label: "Bateria" },
      { key: "spare", category: "RODAS", label: "Estepe" },
      { key: "jack_tools", category: "ACESSORIOS", label: "Chave de rodas e triângulo juntos em uma única foto" },
      { key: "wheel_fr", category: "RODAS", label: "Roda dianteira direita" },
      { key: "wheel_fl", category: "RODAS", label: "Roda dianteira esquerda" },
      { key: "wheel_rr", category: "RODAS", label: "Roda traseira direita" },
      { key: "wheel_rl", category: "RODAS", label: "Roda traseira esquerda" },
      { key: "seats_front", category: "INTERIOR", label: "Bancos dianteiros" },
      { key: "seats_rear", category: "INTERIOR", label: "Bancos traseiros" },
    ],
  };
})(typeof window !== "undefined" ? window : globalThis);
