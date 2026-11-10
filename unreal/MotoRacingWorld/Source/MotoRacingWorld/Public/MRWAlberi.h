// Alberi nei boschi (bosco.bin dei dati) vicino alla moto, come nell'anteprima:
// celle da 250 m create e tolte mentre si guida, latifoglie in basso e abeti sopra i 1100 m.
// Le mesh degli alberi vengono da tools/moto/crea_alberi.py (importate da mrw_importa_moto.py).

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "MRWAlberi.generated.h"

class UStaticMesh;
class UHierarchicalInstancedStaticMeshComponent;
class AMRWTerreno;

UCLASS()
class MOTORACINGWORLD_API AMRWAlberi : public AActor
{
	GENERATED_BODY()

public:
	AMRWAlberi();
	virtual void Tick(float DeltaSeconds) override;

	// Fino a che distanza dalla moto ci sono alberi (metri)
	UPROPERTY(EditAnywhere, Category = "MRW")
	float RaggioM = 1200.0f;

	// Tentativi per cella da 250 x 250 m (circa un albero ogni 100 m2 di bosco)
	UPROPERTY(EditAnywhere, Category = "MRW")
	int32 AlberiPerCella = 650;

protected:
	virtual void BeginPlay() override;

private:
	void CreaCella(const FIntPoint& Cella);

	UPROPERTY() TObjectPtr<UStaticMesh> Latifoglia;
	UPROPERTY() TObjectPtr<UStaticMesh> Conifera;
	UPROPERTY() TObjectPtr<AMRWTerreno> Terreno;

	// cella -> i suoi alberi (due componenti: latifoglie e conifere)
	UPROPERTY()
	TMap<FIntPoint, TObjectPtr<UHierarchicalInstancedStaticMeshComponent>> CelleLatifoglie;

	UPROPERTY()
	TMap<FIntPoint, TObjectPtr<UHierarchicalInstancedStaticMeshComponent>> CelleConifere;

	float Attesa = 0.0f;
};
