// Edifici del Locarnese (OpenStreetMap, dati della pipeline: Dati/edifici.json).
// Muri con finestre (persiane verdi, finestre moderne, capannoni), tetti di coppi, piatti o a punta.
// Le texture delle facciate sono disegnate dal codice (nessuna immagine presa da internet).
// I muri hanno le collisioni: la moto ci sbatte contro.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "MRWEdifici.generated.h"

class UMaterialInterface;
class UTexture2D;
class UProceduralMeshComponent;

UCLASS()
class MOTORACINGWORLD_API AMRWEdifici : public AActor
{
	GENERATED_BODY()

public:
	AMRWEdifici();

	// Materiale con un parametro texture "Facciata" moltiplicato per il colore dei vertici
	UPROPERTY(EditAnywhere, Category = "MRW")
	TObjectPtr<UMaterialInterface> MaterialeEdificio;

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY()
	TArray<TObjectPtr<UProceduralMeshComponent>> Pezzi;

	UPROPERTY()
	TArray<TObjectPtr<UTexture2D>> Texture;
};
