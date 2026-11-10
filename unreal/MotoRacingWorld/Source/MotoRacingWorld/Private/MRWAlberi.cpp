#include "MRWAlberi.h"

#include "Components/HierarchicalInstancedStaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"
#include "MRWTerreno.h"

static const float CELLA = 25000.0f;           // 250 m
static const float QUOTA_CONIFERE = 110000.0f; // 1100 m

AMRWAlberi::AMRWAlberi()
{
	PrimaryActorTick.bCanEverTick = true;
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Radice"));
}

void AMRWAlberi::BeginPlay()
{
	Super::BeginPlay();
	SetActorLocation(FVector::ZeroVector);
	Latifoglia = LoadObject<UStaticMesh>(nullptr, TEXT("/Game/MRW/Alberi/MRW_Latifoglia.MRW_Latifoglia"), nullptr, LOAD_NoWarn | LOAD_Quiet);
	Conifera = LoadObject<UStaticMesh>(nullptr, TEXT("/Game/MRW/Alberi/MRW_Conifera.MRW_Conifera"), nullptr, LOAD_NoWarn | LOAD_Quiet);
	if (Latifoglia == nullptr || Conifera == nullptr)
	{
		UE_LOG(LogTemp, Warning, TEXT("[MRW] Alberi non importati: lancia Content/Python/mrw_importa_moto.py"));
	}
	for (TActorIterator<AMRWTerreno> It(GetWorld()); It; ++It)
	{
		Terreno = *It;
	}
}

void AMRWAlberi::CreaCella(const FIntPoint& Cella)
{
	// stesso seme per la stessa cella: gli alberi sono sempre negli stessi posti
	FRandomStream Caso(Cella.X * 73856093 ^ Cella.Y * 19349663);
	TArray<FTransform> Basso, Alto;
	for (int32 i = 0; i < AlberiPerCella; i++)
	{
		const float X = (Cella.X + Caso.FRand()) * CELLA;
		const float Y = (Cella.Y + Caso.FRand()) * CELLA;
		const float Scala = 0.7f + Caso.FRand() * 0.8f;
		const float Giro = Caso.FRand() * 360.0f;
		if (!Terreno->BoscoQui(X, Y)) continue;
		if (Terreno->VicinoAStrada(X, Y, 350.0f)) continue;   // niente alberi sulle strade (3.5 m di margine)
		const float Z = Terreno->QuotaTerreno(X, Y) - 20.0f;
		const FTransform Posto(FRotator(0.0f, Giro, 0.0f), FVector(X, Y, Z), FVector(Scala));
		if (Z > QUOTA_CONIFERE) Alto.Add(Posto);
		else Basso.Add(Posto);
	}

	auto Crea = [this](UStaticMesh* Mesh, const TArray<FTransform>& Posti) -> UHierarchicalInstancedStaticMeshComponent*
	{
		if (Mesh == nullptr || Posti.Num() == 0) return nullptr;
		UHierarchicalInstancedStaticMeshComponent* Gruppo = NewObject<UHierarchicalInstancedStaticMeshComponent>(this);
		Gruppo->SetStaticMesh(Mesh);
		Gruppo->SetupAttachment(RootComponent);
		Gruppo->SetCollisionEnabled(ECollisionEnabled::QueryOnly);   // la moto li sente (urto) ma la fisica non li muove
		Gruppo->SetCullDistances(0, 150000);                          // oltre 1.5 km non si disegnano
		Gruppo->RegisterComponent();
		Gruppo->AddInstances(Posti, false);
		return Gruppo;
	};
	CelleLatifoglie.Add(Cella, Crea(Latifoglia, Basso));
	CelleConifere.Add(Cella, Crea(Conifera, Alto));
}

void AMRWAlberi::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	Attesa -= DeltaSeconds;
	if (Attesa > 0.0f || Terreno == nullptr || !Terreno->DatiPronti())
	{
		return;
	}
	Attesa = 0.3f;
	const APawn* Moto = UGameplayStatics::GetPlayerPawn(this, 0);
	if (Moto == nullptr)
	{
		return;
	}
	const FVector Posizione = Moto->GetActorLocation();
	const float Raggio = RaggioM * 100.0f;

	// tolgo le celle lontane
	TArray<FIntPoint> Lontane;
	for (const auto& Coppia : CelleLatifoglie)
	{
		const FVector Centro((Coppia.Key.X + 0.5f) * CELLA, (Coppia.Key.Y + 0.5f) * CELLA, 0.0f);
		if (FVector::Dist2D(Centro, Posizione) > Raggio + CELLA) Lontane.Add(Coppia.Key);
	}
	for (const FIntPoint& Cella : Lontane)
	{
		if (CelleLatifoglie[Cella]) CelleLatifoglie[Cella]->DestroyComponent();
		if (CelleConifere[Cella]) CelleConifere[Cella]->DestroyComponent();
		CelleLatifoglie.Remove(Cella);
		CelleConifere.Remove(Cella);
	}

	// creo quelle vicine che mancano (al massimo 2 per volta, per non bloccare il gioco)
	const int32 Cx = FMath::FloorToInt(Posizione.X / CELLA);
	const int32 Cy = FMath::FloorToInt(Posizione.Y / CELLA);
	const int32 Quante = FMath::CeilToInt(Raggio / CELLA);
	int32 Nuove = 0;
	for (int32 y = Cy - Quante; y <= Cy + Quante && Nuove < 2; y++)
	{
		for (int32 x = Cx - Quante; x <= Cx + Quante && Nuove < 2; x++)
		{
			const FIntPoint Cella(x, y);
			const FVector Centro((x + 0.5f) * CELLA, (y + 0.5f) * CELLA, 0.0f);
			if (CelleLatifoglie.Contains(Cella) || FVector::Dist2D(Centro, Posizione) > Raggio) continue;
			CreaCella(Cella);
			Nuove++;
		}
	}
}
