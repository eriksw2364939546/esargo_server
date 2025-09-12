export const parseNestedFormData = (req, res, next) => {
  const body = req.body;
  const parsed = {};
  
  Object.keys(body).forEach(key => {
    if (key.includes('[') && key.includes(']')) {
      const match = key.match(/^(\w+)\[(\w+)\]$/);
      if (match) {
        const [, parent, child] = match;
        if (!parsed[parent]) parsed[parent] = {};
        parsed[parent][child] = body[key];
      }
    } else {
      parsed[key] = body[key];
    }
  });
  
  req.body = { ...parsed };
  next();
};