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
  function choice(key, label, choices, opts) {
    return { key, label, kind: "choice", choices: choices || [], ...(opts || {}) };
  }

  const RETRO_TYPES = [
    { value: "ELETRICO", label: "Elétrico" },
    { value: "MANUAL", label: "Manual" },
  ];
  const WHEEL_TYPES = [
    { value: "LIGA", label: "Liga" },
    { value: "FERRO", label: "Ferro" },
    { value: "AUSENTE", label: "Ausente" },
  ];
  const SIM_NAO = [
    { value: "SIM", label: "Sim" },
    { value: "NAO", label: "Não" },
  ];
  const TURBO_TYPES = [
    { value: "ASPIRADO", label: "Aspirado" },
    { value: "REBAIXADO", label: "Rebaixado" },
  ];

  function sideItems(prefix) {
    return [
      cls(prefix + "_para_lama_diant", "Paralama Dianteiro"),
      cls(prefix + "_para_lama_tras", "Paralama Traseiro"),
      cls(prefix + "_porta_diant", "Porta Dianteira"),
      cls(prefix + "_porta_tras", "Porta Traseira"),
      cls(prefix + "_macaneta", "Maçaneta"),
      cls(prefix + "_retrovisor", "Retrovisor", {
        choiceKey: prefix + "_retrovisor_tipo",
        choiceLabel: "Tipo",
        choices: RETRO_TYPES,
      }),
      cls(prefix + "_vidros", "Vidros", {
        choiceKey: prefix + "_vidros_tipo",
        choiceLabel: "Tipo",
        choices: RETRO_TYPES,
      }),
      cls(prefix + "_friso", "Frisos"),
    ];
  }

  function wheelItem(key, label) {
    return cls(key, label, {
      choiceKey: key + "_tipo",
      choiceLabel: "Tipo",
      choices: WHEEL_TYPES,
    });
  }

  function wheelMarca(key) {
    return txt(key, "Marca/Tipo", "Marca / medida");
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
      title: "INTERIOR",
      blocks: [
        {
          items: [
            cls("interno_assoalho", "Assoalho"),
            cls("interno_tapetes", "Tapetes"),
            cls("interno_macaneta", "Maçanetas"),
            cls("interno_painel", "Painel/Console"),
            cls("interno_bancos_altos", "Bancos Dianteiros"),
            cls("interno_bancos_baixos", "Banco Traseiro"),
            cls("interno_revestimentos", "Revestimentos"),
            cls("interno_porta_luvas", "Porta Luvas"),
            cls("interno_para_sol", "Para Sol"),
            cls("interno_acendedor", "Acendedor de cig."),
            cls("interno_retrovisor", "Retrovisor Intern."),
            cls("interno_encosto_cabeca", "Encosto de Cabeça"),
          ],
        },
        {
          title: "EQUIPAMENTOS OBRIGATÓRIOS",
          items: [
            cls("interno_cinto_seguranca", "Cintos de Segurança"),
            cls("interno_macaco", "Macaco"),
            cls("interno_chave_roda", "Chave de Roda"),
            cls("interno_triangulo", "Triângulo"),
            cls("interno_extintor", "Extintor"),
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
            cls("mec_injecao_eletronica", "Injeção Elet./Carburad."),
            cls("mec_radiador", "Radiador"),
            cls("mec_motor_arranque", "Motor de Arranque"),
            cls("mec_diferencial", "Diferencial"),
            cls("mec_cambio", "Câmbio - Tipo", {
              textKey: "mec_cambio_tipo",
              textLabel: "Tipo",
              textPlaceholder: "4M, 5M, Aut…",
            }),
            cls("mec_freios_abs", "Freios: ABS"),
            cls("mec_ar_condicionado", "Ar Condicionado"),
            cls("mec_bomba_dir_hidraulica", "Direção Hidráulica"),
            cls("mec_embreagem", "Embreagem"),
            cls("eq_buzina", "Buzina"),
            cls("eq_alarme", "Alarme"),
            cls("mec_bateria", "Bateria"),
          ],
        },
      ],
    },
    {
      id: "traseira",
      title: "TRASEIRA",
      blocks: [
        {
          items: [cls("tras_capo", "Capô"), cls("tras_sala", "Saia")],
        },
      ],
    },
    {
      id: "equipamentos",
      title: "ACESSÓRIOS",
      blocks: [
        {
          items: [
            cls("eq_radio", "Rádio"),
            cls("eq_toca_fitas", "T. Fitas"),
            cls("eq_cd", "CD"),
            cls("eq_dvd", "DVD"),
            cls("eq_usb", "USB"),
            cls("eq_gps", "GPS"),
            txt("eq_marca", "Marca"),
            txt("eq_modelo", "Modelo"),
            cls("eq_antena", "Antena Interna"),
            cls("eq_antena_externa", "Antena Externa"),
            cls("eq_alto_falantes", "Alto Falantes Portas Dianteiras", {
              numberKey: "eq_alto_falantes_qtd",
              numberLabel: "Qtd.",
            }),
            cls("eq_alto_falantes_tras", "Alto Falantes Portas Traseiras", {
              numberKey: "eq_alto_falantes_tras_qtd",
              numberLabel: "Qtd.",
            }),
            cls("eq_tampao", "Alto Falantes Tampão/Painel", {
              numberKey: "eq_tampao_qtd",
              numberLabel: "Qtd.",
            }),
            cls("eq_turbo", "Turbo", {
              choiceKey: "eq_turbo_tipo",
              choiceLabel: "Tipo",
              choices: TURBO_TYPES,
            }),
            cls("eq_kit_gas", "Kit Gás", {
              textKey: "eq_kit_gas_desc",
              textLabel: "Desc.",
              textPlaceholder: "Descrição do kit gás",
            }),
            choice("eq_cabo_carregador", "Cabo Carregador (Se Hibr. ou Elétr.)", SIM_NAO),
            txt("eq_bateria_marca", "Bateria/Marca"),
            txt("eq_obs", "OBS."),
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
            cls("dian_para_choque", "Pára-choque"),
            cls("dian_para_brisa", "Parabrisa"),
            cls("dian_limpadores", "Limp de Parabrisa"),
            cls("dian_farois", "Faróis"),
            cls("dian_farois_aux", "Faróis Aux. (Qtd)", {
              numberKey: "dian_farois_aux_qtd",
              numberLabel: "Qtd.",
            }),
            cls("dian_lanternas", "Lanternas"),
            cls("dian_teto", "Teto"),
            cls("dian_sala", "Saia"),
            cls("dian_grade", "Grade"),
          ],
        },
      ],
    },
    {
      id: "lado_esquerdo",
      title: "LATERAL ESQUERDA",
      blocks: [{ items: sideItems("lesq") }],
    },
    {
      id: "lado_direito",
      title: "LATERAL DIREITA",
      blocks: [{ items: sideItems("ldir") }],
    },
    {
      id: "rodas",
      title: "RODAS E PNEUS",
      blocks: [
        {
          items: [
            wheelItem("rod_estepe", "Estepe"),
            wheelMarca("rod_estepe_marca_tipo"),
            wheelItem("rod_pneu_dd", "Diant. Dir."),
            wheelMarca("rod_pneu_dd_marca_tipo"),
            wheelItem("rod_pneu_de", "Diant. Esq."),
            wheelMarca("rod_pneu_de_marca_tipo"),
            wheelItem("rod_pneu_td", "Tras. Dir."),
            wheelMarca("rod_pneu_td_marca_tipo"),
            wheelItem("rod_pneu_te", "Tras. Esq."),
            wheelMarca("rod_pneu_te_marca_tipo"),
            choice("rod_run_flat", "Reparador Run Flat?", SIM_NAO),
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

  function extraFields(it) {
    return {
      numberKey: it.numberKey || null,
      numberLabel: it.numberLabel || null,
      choiceKey: it.choiceKey || null,
      choiceLabel: it.choiceLabel || null,
      choices: it.choices || null,
      textKey: it.textKey || null,
      textLabel: it.textLabel || null,
      textPlaceholder: it.textPlaceholder || null,
    };
  }

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
            blockTitle: block.title || null,
            ...extraFields(it),
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
