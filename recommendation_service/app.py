import os
import numpy as np
import pandas as pd
from scipy.sparse import load_npz
from sklearn.metrics.pairwise import cosine_similarity
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

app = FastAPI(title="Fashion Recommender Debug Mode")

MODEL_PATH = os.path.join("..", "model", "hybrid_feature_matrix.npz")
CSV_PATH = os.path.join("..", "Fashion_Dataset_Cleaned.csv")

print("\n=== STARTING PYTHON RECOMMENDATION SERVER ===")
try:
    feature_matrix = load_npz(MODEL_PATH)
    df_original = pd.read_csv(CSV_PATH)
    print(f"[OK] Loaded Dataset with {len(df_original)} total products.")
except Exception as e:
    print(f"[ERROR] Could not load files: {e}")

# Match the number of products loaded into MongoDB (500)
LIMIT = 500
df_db = df_original.iloc[:LIMIT].reset_index(drop=True)
db_feature_matrix = feature_matrix[:LIMIT]

# Filter out rows with NaN p_id before building the mapping
valid_mask = df_db["p_id"].notna()
p_id_to_idx = {}
for idx, row in df_db.iterrows():
    if pd.notna(row["p_id"]):
        p_id_to_idx[str(int(float(row["p_id"])))] = idx
print(f"[OK] Successfully mapped {len(p_id_to_idx)} products for fast searching.\n")

class RecommendationResponse(BaseModel):
    p_id: str
    name: str
    brand: str
    price: float

@app.get("/recommend", response_model=List[RecommendationResponse])
async def recommend(product_id: str, top_n: int = 4):
    print(f"\n---> NEW INCOMING REQUEST")
    print(f"Target Product ID: {product_id}")

    if product_id not in p_id_to_idx:
        print(f"[WARNING] Product {product_id} is not in our {LIMIT} item database!")
        raise HTTPException(status_code=404, detail="Product not found in dataset")

    query_idx = p_id_to_idx[product_id]
    query_vec = db_feature_matrix[query_idx].reshape(1, -1)
    sim_scores = cosine_similarity(query_vec, db_feature_matrix).flatten()

    # Get top N+extra indices (excluding the item itself), skip NaN p_id rows
    top_indices = np.argsort(sim_scores)[::-1]

    results = []
    print(f"Generating Top {top_n} Recommendations:")
    for i in top_indices:
        if len(results) >= top_n:
            break
        if int(i) == query_idx:
            continue
        row = df_db.iloc[int(i)]
        if pd.isna(row["p_id"]):
            continue

        rec_id = str(int(float(row["p_id"])))
        rec_name = str(row["name"]) if pd.notna(row["name"]) else "Unknown"

        print(f"  -> Recommending: [ID: {rec_id}] {rec_name[:30]}...")

        results.append({
            "p_id": rec_id,
            "name": rec_name,
            "brand": str(row.get("brand", "Unknown")) if pd.notna(row.get("brand")) else "Unknown",
            "price": float(row.get("price", 0.0)) if pd.notna(row.get("price")) else 0.0
        })

    print("---> REQUEST COMPLETE")
    return results

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
  
