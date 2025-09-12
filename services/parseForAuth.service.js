export const parseNestedFormData = (req, res, next) => {
  try {
    const body = req.body;
    const parsed = {};
    
    Object.keys(body).forEach(key => {
      const value = body[key];
      const cleanKey = key.trim(); // ✅ УБИРАЕМ ПРОБЕЛЫ!
      
      // Проверяем на паттерн parent[child]
      const match = cleanKey.match(/^(\w+)\[(\w+)\]$/);
      if (match) {
        const [, parent, child] = match;
        if (!parsed[parent]) {
          parsed[parent] = {};
        }
        parsed[parent][child] = value;
      } else {
        // Обычные поля остаются как есть
        parsed[cleanKey] = value;
      }
    });
    
    console.log('🔧 PARSE NESTED FORM DATA:', {
      original_keys: Object.keys(body),
      parsed_keys: Object.keys(parsed),
      legal_data_structure: parsed.legal_data ? Object.keys(parsed.legal_data) : 'missing'
    });
    
    req.body = { ...parsed };
    next();
    
  } catch (error) {
    console.error('🚨 PARSE NESTED FORM DATA ERROR:', error);
    next(error);
  }
};