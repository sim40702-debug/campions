// Terreno e strade del Ticino letti dai dati della pipeline (tools/geo, passi 7 e 8).
//
// Legge dalla cartella "Dati" del progetto (la stessa dell'anteprima):
//   terreno.json / terreno.bin   quote swissALTI3D ogni 3.94 m
//   strade.json                  strade OpenStreetMap con profilo gia' liscio
//   foto/foto_xC_yR.jpg          foto aeree SWISSIMAGE, una ogni 2 x 2 km
//
// Crea:
// - tutto il terreno con poco dettaglio (un punto ogni 15.7 m), senza collisioni
// - vicino alla moto il terreno con tutto il dettaglio (3.94 m) e le collisioni
// - le strade come nastri di asfalto con collisioni
// - il lago (piano dell'acqua alla quota del Verbano)
//
// Questo e' il primo passo dell'open world: piu' avanti il terreno diventa un Landscape
// con World Partition (vedi docs/unreal/PIANO_TECNICO_UE5.md, fase 7).
//
// Coordinate: X = est, Y = sud, Z = quota (centimetri). Il centro dell'area e' lo 0.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "MRWTerreno.generated.h"

class UProceduralMeshComponent;
class UMaterialInterface;
class UTexture2D;

// Una strada letta da strade.json
struct FMRWStrada
{
	FString Nome;
	FString Tipo;
	bool Galleria = false;
	bool Ponte = false;
	TArray<FVector> Punti;     // centimetri
	TArray<float> Larghezze;   // centimetri, una per punto
};

UCLASS()
class MOTORACINGWORLD_API AMRWTerreno : public AActor
{
	GENERATED_BODY()

public:
	AMRWTerreno();

	virtual void Tick(float DeltaSeconds) override;

	// Materiale del terreno: deve avere un parametro texture "Foto"
	UPROPERTY(EditAnywhere, Category = "MRW")
	TObjectPtr<UMaterialInterface> MaterialeTerreno;

	UPROPERTY(EditAnywhere, Category = "MRW")
	TObjectPtr<UMaterialInterface> MaterialeStrada;

	UPROPERTY(EditAnywhere, Category = "MRW")
	TObjectPtr<UMaterialInterface> MaterialeAcqua;

	// Fino a che distanza dalla moto il terreno ha tutto il dettaglio (metri)
	UPROPERTY(EditAnywhere, Category = "MRW", meta = (ClampMin = "300.0", ClampMax = "3000.0"))
	float RaggioDettaglioM = 800.0f;

	// I dati sono stati letti?
	bool DatiPronti() const { return bPronto; }

	// Messaggio da mostrare se i dati mancano
	FString Errore;

	// Il componente delle strade (la moto lo usa per sapere se e' sull'asfalto)
	UProceduralMeshComponent* GetStrade() const { return Strade; }

	// Quota del terreno (cm) nel punto X, Y (cm)
	float QuotaTerreno(float X, float Y) const;

	// Punto di strada piu' vicino a "Vicino": posizione e direzione della strada
	bool PuntoStradaVicino(const FVector& Vicino, FVector& Punto, FVector& Direzione) const;

protected:
	virtual void BeginPlay() override;

private:
	bool LeggiTerreno(const FString& Cartella);
	void LeggiStrade(const FString& Cartella);
	void LeggiFoto(const FString& Cartella);

	void CreaTerrenoLontano();
	void CreaStrade();
	void CreaLago();
	void AggiornaTerrenoVicino();

	// Riempie vertici e triangoli di un pezzo di terreno (colonne e righe della griglia)
	void CostruisciPezzo(int32 Colonna0, int32 Riga0, int32 Quad, int32 Salto, float Abbassa,
		TArray<FVector>& Vertici, TArray<int32>& Triangoli, TArray<FVector>& Normali, TArray<FVector2D>& UV) const;

	FVector PuntoGriglia(int32 Colonna, int32 Riga) const;
	float QuotaGriglia(int32 Colonna, int32 Riga) const;
	UMaterialInterface* MaterialeFoto(int32 FotoX, int32 FotoY);

	UPROPERTY()
	TObjectPtr<UProceduralMeshComponent> TerrenoLontano;

	UPROPERTY()
	TObjectPtr<UProceduralMeshComponent> Strade;

	UPROPERTY()
	TObjectPtr<UProceduralMeshComponent> Lago;

	// Pezzi di terreno dettagliato vicino alla moto (chiave = colonna, riga del pezzo)
	UPROPERTY()
	TMap<FIntPoint, TObjectPtr<UProceduralMeshComponent>> PezziVicini;

	// Foto aeree e materiali (chiave = foto x, y)
	UPROPERTY()
	TMap<FIntPoint, TObjectPtr<UTexture2D>> Foto;

	UPROPERTY()
	TMap<FIntPoint, TObjectPtr<UMaterialInterface>> MaterialiFoto;

	TArray<float> Quote;       // metri, riga per riga da nord a sud
	TArray<FMRWStrada> ListaStrade;
	int32 Colonne = 0;
	int32 Righe = 0;
	float PassoM = 3.937f;
	float MetaX = 0.0f;        // metri
	float MetaY = 0.0f;        // metri
	float LivelloLago = 193.3f;
	bool bPronto = false;
	float TempoAggiornamento = 0.0f;
};
