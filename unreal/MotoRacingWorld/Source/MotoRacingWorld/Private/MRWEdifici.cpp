#include "MRWEdifici.h"

#include "Dom/JsonObject.h"
#include "Algo/Reverse.h"
#include "Engine/CollisionProfile.h"
#include "Engine/Texture2D.h"
#include "Materials/Material.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "ProceduralMeshComponent.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

// Gruppi di triangoli: uno per ogni materiale
enum EMRWTipo { Persiane = 0, Finestre, Capannone, Lisci, Tegole, Piatti, NumeroTipi };

struct FMRWGruppo
{
	TArray<FVector> Vertici;
	TArray<int32> Triangoli;
	TArray<FVector> Normali;
	TArray<FVector2D> UV;
	TArray<FLinearColor> Colori;
};

struct FMRWPezzoCitta
{
	FMRWGruppo Gruppi[NumeroTipi];
};

static const float LATO_PEZZO = 50000.0f;   // 500 m

// ------------------------------------------------------------------ texture disegnate dal codice

static void Rettangolo(TArray<FColor>& Pixel, int32 X0, int32 Y0, int32 X1, int32 Y1, FColor Colore)
{
	for (int32 y = FMath::Max(Y0, 0); y < FMath::Min(Y1, 256); y++)
	{
		for (int32 x = FMath::Max(X0, 0); x < FMath::Min(X1, 256); x++)
		{
			Pixel[y * 256 + x] = Colore;
		}
	}
}

static UTexture2D* NuovaTexture(const TArray<FColor>& Pixel)
{
	UTexture2D* Tex = UTexture2D::CreateTransient(256, 256, PF_B8G8R8A8);
	void* Dati = Tex->GetPlatformData()->Mips[0].BulkData.Lock(LOCK_READ_WRITE);
	FMemory::Memcpy(Dati, Pixel.GetData(), Pixel.Num() * sizeof(FColor));
	Tex->GetPlatformData()->Mips[0].BulkData.Unlock();
	Tex->SRGB = true;
	Tex->UpdateResource();
	return Tex;
}

// Una "campata" di facciata (un piano alto 3 m, largo 3 m) con una finestra
static UTexture2D* TexturaFacciata(bool bPersiane)
{
	TArray<FColor> Pixel;
	Pixel.Init(FColor(250, 250, 250), 256 * 256);
	FRandomStream Caso(bPersiane ? 3 : 5);
	for (int32 i = 0; i < 1500; i++)   // intonaco non perfetto
	{
		const uint8 Chiaro = 255 - Caso.RandRange(0, 22);
		const int32 X = Caso.RandRange(0, 254);
		const int32 Y = Caso.RandRange(0, 254);
		Rettangolo(Pixel, X, Y, X + 2, Y + 2, FColor(Chiaro, Chiaro, Chiaro));
	}
	Rettangolo(Pixel, 84, 52, 172, 204, FColor(244, 242, 236));          // cornice
	for (int32 y = 60; y < 196; y++)                                       // vetro: piu' chiaro in alto (cielo)
	{
		const float T = (y - 60) / 136.0f;
		const FColor Vetro = FLinearColor::LerpUsingHSV(FLinearColor(0.45f, 0.55f, 0.65f), FLinearColor(0.12f, 0.16f, 0.2f), T).ToFColor(true);
		Rettangolo(Pixel, 92, y, 164, y + 1, Vetro);
	}
	Rettangolo(Pixel, 126, 60, 130, 196, FColor(244, 242, 236));          // montante
	Rettangolo(Pixel, 92, 120, 164, 124, FColor(244, 242, 236));          // traverso
	Rettangolo(Pixel, 78, 204, 178, 212, FColor(185, 182, 174));          // davanzale
	if (bPersiane)
	{
		for (int32 X : { 44, 172 })                                          // persiane verdi aperte
		{
			Rettangolo(Pixel, X, 58, X + 40, 200, FColor(79, 122, 85));
			for (int32 y = 62; y < 196; y += 7)
			{
				Rettangolo(Pixel, X + 3, y, X + 37, y + 2, FColor(61, 98, 67));
			}
		}
	}
	return NuovaTexture(Pixel);
}

static UTexture2D* TexturaCapannone()
{
	TArray<FColor> Pixel;
	Pixel.Init(FColor(242, 242, 242), 256 * 256);
	for (int32 x = 0; x < 256; x += 32)
	{
		Rettangolo(Pixel, x, 0, x + 3, 256, FColor(213, 213, 213));       // pannelli di lamiera
	}
	Rettangolo(Pixel, 0, 40, 256, 86, FColor(74, 88, 102));               // finestre a nastro
	for (int32 x = 0; x < 256; x += 64)
	{
		Rettangolo(Pixel, x, 40, x + 4, 86, FColor(232, 232, 232));
	}
	return NuovaTexture(Pixel);
}

static UTexture2D* TexturaTegole()
{
	TArray<FColor> Pixel;
	Pixel.Init(FColor(142, 74, 51), 256 * 256);
	for (int32 y = 0; y < 256; y += 32)
	{
		for (int32 x = (y / 32) % 2 == 0 ? 0 : 16; x < 256 + 32; x += 32)
		{
			for (int32 i = -15; i < 15; i++)   // coppo: chiaro al centro, scuro ai bordi
			{
				const float Luce = 1.0f - FMath::Abs(i) / 15.0f;
				const FColor Colore(110 + Luce * 67, 52 + Luce * 44, 36 + Luce * 27);
				Rettangolo(Pixel, x + i, y + 2, x + i + 1, y + 30, Colore);
			}
		}
	}
	return NuovaTexture(Pixel);
}

static UTexture2D* TexturaBianca()
{
	TArray<FColor> Pixel;
	Pixel.Init(FColor(255, 255, 255), 256 * 256);
	return NuovaTexture(Pixel);
}

// ------------------------------------------------------------------ geometria

static void Triangolo(FMRWGruppo& G, const FVector& A, const FVector& B, const FVector& C, const FLinearColor& Colore, float ScalaUV)
{
	FVector Normale = FVector::CrossProduct(B - A, C - A).GetSafeNormal();
	if (Normale.Z < 0.0f)
	{
		Normale = -Normale;   // tetti: la normale guarda in su
	}
	const int32 Inizio = G.Vertici.Num();
	for (const FVector& V : { A, B, C })
	{
		G.Vertici.Add(V);
		G.Normali.Add(Normale);
		G.UV.Add(FVector2D(V.X / ScalaUV, V.Y / ScalaUV));
		G.Colori.Add(Colore);
	}
	G.Triangoli.Append({ Inizio, Inizio + 1, Inizio + 2 });
}

// Muro da A a B, dal basso all'alto, con le UV in "finestre" (campate e piani da circa 3 m)
static void Muro(FMRWGruppo& G, const FVector2D& A, const FVector2D& B, float Basso, float Alto, const FLinearColor& Colore)
{
	const float Lungo = FVector2D::Distance(A, B) / 100.0f;
	const float Campate = FMath::Max(1, FMath::RoundToInt(Lungo / 3.0f));
	const float Piani = FMath::Max(1, FMath::RoundToInt((Alto - Basso) / 300.0f));
	const FVector2D Direzione = (B - A).GetSafeNormal();
	const FVector Normale(Direzione.Y, -Direzione.X, 0.0f);
	const int32 Inizio = G.Vertici.Num();
	G.Vertici.Append({ FVector(A.X, A.Y, Basso), FVector(B.X, B.Y, Basso), FVector(B.X, B.Y, Alto), FVector(A.X, A.Y, Alto) });
	G.UV.Append({ FVector2D(0, Piani), FVector2D(Campate, Piani), FVector2D(Campate, 0), FVector2D(0, 0) });
	for (int32 i = 0; i < 4; i++)
	{
		G.Normali.Add(Normale);
		G.Colori.Add(Colore);
	}
	G.Triangoli.Append({ Inizio, Inizio + 1, Inizio + 2, Inizio, Inizio + 2, Inizio + 3 });
}

static float Area(const TArray<FVector2D>& P)
{
	float Somma = 0.0f;
	for (int32 i = 0; i < P.Num(); i++)
	{
		const FVector2D& A = P[i];
		const FVector2D& B = P[(i + 1) % P.Num()];
		Somma += A.X * B.Y - B.X * A.Y;
	}
	return Somma / 2.0f;   // con il segno (serve per il verso del contorno)
}

// Tetto piatto: triangolazione "a orecchie" (funziona anche con contorni a L, a U...)
static void TettoPiatto(FMRWGruppo& G, TArray<FVector2D> P, float Z, const FLinearColor& Colore)
{
	if (Area(P) < 0.0f)
	{
		Algo::Reverse(P);
	}
	int32 Giri = 0;
	while (P.Num() > 3 && Giri < 1000)
	{
		Giri++;
		bool bTrovato = false;
		for (int32 i = 0; i < P.Num(); i++)
		{
			const FVector2D& A = P[(i + P.Num() - 1) % P.Num()];
			const FVector2D& B = P[i];
			const FVector2D& C = P[(i + 1) % P.Num()];
			if (FVector2D::CrossProduct(B - A, C - B) <= 0.0f)
			{
				continue;   // angolo rientrante: non e' un'orecchia
			}
			bool bDentro = false;
			for (const FVector2D& Q : P)
			{
				if (Q == A || Q == B || Q == C) continue;
				const float D1 = FVector2D::CrossProduct(B - A, Q - A);
				const float D2 = FVector2D::CrossProduct(C - B, Q - B);
				const float D3 = FVector2D::CrossProduct(A - C, Q - C);
				if (D1 > 0 && D2 > 0 && D3 > 0)
				{
					bDentro = true;
					break;
				}
			}
			if (bDentro) continue;
			Triangolo(G, FVector(A, Z), FVector(B, Z), FVector(C, Z), Colore, 200.0f);
			P.RemoveAt(i);
			bTrovato = true;
			break;
		}
		if (!bTrovato) break;
	}
	if (P.Num() == 3)
	{
		Triangolo(G, FVector(P[0], Z), FVector(P[1], Z), FVector(P[2], Z), Colore, 200.0f);
	}
}

static void TettoAPunta(FMRWGruppo& G, const TArray<FVector2D>& P, float Z, float AltezzaPunta, const FLinearColor& Colore)
{
	FVector2D Centro(0, 0);
	for (const FVector2D& Q : P) Centro += Q;
	Centro /= P.Num();
	const FVector Punta(Centro, Z + AltezzaPunta);
	for (int32 i = 0; i < P.Num(); i++)
	{
		Triangolo(G, FVector(P[i], Z), FVector(P[(i + 1) % P.Num()], Z), Punta, Colore, 200.0f);
	}
}

static void TettoADueFalde(FMRWPezzoCitta& Pezzo, TArray<FVector2D> P, float Z, const FLinearColor& ColoreMuro)
{
	// il colmo va nel senso del lato lungo
	if (FVector2D::Distance(P[0], P[1]) < FVector2D::Distance(P[1], P[2]))
	{
		P = { P[1], P[2], P[3], P[0] };
	}
	const float Corto = FVector2D::Distance(P[1], P[2]) / 100.0f;
	const float Colmo = Z + FMath::Min(4.0f, Corto * 0.35f) * 100.0f;
	const FVector A(P[0], Z), B(P[1], Z), C(P[2], Z), D(P[3], Z);
	const FVector MBC((P[1] + P[2]) / 2.0f, Colmo);
	const FVector MDA((P[3] + P[0]) / 2.0f, Colmo);
	const FLinearColor Bianco(1, 1, 1);
	Triangolo(Pezzo.Gruppi[Tegole], A, B, MBC, Bianco, 200.0f);
	Triangolo(Pezzo.Gruppi[Tegole], A, MBC, MDA, Bianco, 200.0f);
	Triangolo(Pezzo.Gruppi[Tegole], C, D, MDA, Bianco, 200.0f);
	Triangolo(Pezzo.Gruppi[Tegole], C, MDA, MBC, Bianco, 200.0f);
	Triangolo(Pezzo.Gruppi[Lisci], B, C, MBC, ColoreMuro, 300.0f);   // timpani
	Triangolo(Pezzo.Gruppi[Lisci], D, A, MDA, ColoreMuro, 300.0f);
}

// ------------------------------------------------------------------ attore

AMRWEdifici::AMRWEdifici()
{
	PrimaryActorTick.bCanEverTick = false;
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Radice"));
}

void AMRWEdifici::BeginPlay()
{
	Super::BeginPlay();
	SetActorLocation(FVector::ZeroVector);

	const FString File = FPaths::ConvertRelativePathToFull(FPaths::ProjectDir() / TEXT("Dati") / TEXT("edifici.json"));
	FString Testo;
	if (!FFileHelper::LoadFileToString(Testo, *File))
	{
		UE_LOG(LogTemp, Warning, TEXT("[MRW] Manca %s: niente edifici"), *File);
		return;
	}
	TSharedPtr<FJsonObject> Radice;
	TSharedRef<TJsonReader<>> Lettore = TJsonReaderFactory<>::Create(Testo);
	if (!FJsonSerializer::Deserialize(Lettore, Radice) || !Radice.IsValid())
	{
		return;
	}

	const uint32 ColoriMuri[6] = { 0xf2efe6, 0xe9dcc0, 0xf1e2a8, 0xe9c9bd, 0xd5d5d0, 0xd9b98a };
	TMap<FIntPoint, FMRWPezzoCitta> Citta;
	int32 Quanti = 0;

	for (const TSharedPtr<FJsonValue>& Valore : Radice->GetArrayField(TEXT("edifici")))
	{
		const TSharedPtr<FJsonObject> E = Valore->AsObject();
		const TArray<TSharedPtr<FJsonValue>>& Numeri = E->GetArrayField(TEXT("p"));
		TArray<FVector2D> P;
		for (int32 i = 0; i + 1 < Numeri.Num(); i += 2)
		{
			P.Add(FVector2D(Numeri[i]->AsNumber(), Numeri[i + 1]->AsNumber()) * 100.0f);   // X = est, Y = sud (cm)
		}
		if (P.Num() < 3) continue;
		const float Basso = E->GetNumberField(TEXT("b")) * 100.0f;
		const float Alto = E->GetNumberField(TEXT("h")) * 100.0f;
		const int32 TipoTetto = E->GetIntegerField(TEXT("t"));
		const int32 Colore = E->GetIntegerField(TEXT("c"));
		int32 Speciale = 0;   // 1 chiesa, 2 campanile
		E->TryGetNumberField(TEXT("k"), Speciale);

		FMRWPezzoCitta& Pezzo = Citta.FindOrAdd(FIntPoint(FMath::FloorToInt(P[0].X / LATO_PEZZO), FMath::FloorToInt(P[0].Y / LATO_PEZZO)));
		const FLinearColor ColoreMuro = FLinearColor(FColor::FromHex(FString::Printf(TEXT("%06x"), Speciale > 0 ? 0xe4ddd0 : ColoriMuri[Colore % 6])));
		const float AreaM2 = FMath::Abs(Area(P)) / 10000.0f;

		// che facciata: chiese lisce, capannoni (grandi e bassi), case con o senza persiane
		EMRWTipo Facciata = Colore % 3 == 0 ? Finestre : Persiane;
		if (Speciale > 0) Facciata = Lisci;
		else if (TipoTetto != 1 && AreaM2 > 900.0f && (Alto - Basso) < 1200.0f) Facciata = Capannone;

		for (int32 i = 0; i < P.Num(); i++)
		{
			Muro(Pezzo.Gruppi[Facciata], P[i], P[(i + 1) % P.Num()], Basso, Alto, ColoreMuro);
		}

		// tetto
		if (Speciale == 2)
		{
			TettoAPunta(Pezzo.Gruppi[Tegole], P, Alto, FMath::Max(400.0f, FMath::Sqrt(AreaM2) * 110.0f), FLinearColor::White);
		}
		else if (TipoTetto == 1 && (Speciale == 1 || AreaM2 < 900.0f))
		{
			if (P.Num() == 4) TettoADueFalde(Pezzo, P, Alto, ColoreMuro);
			else TettoAPunta(Pezzo.Gruppi[Tegole], P, Alto, FMath::Min(350.0f, FMath::Sqrt(AreaM2) * 30.0f), FLinearColor::White);
		}
		else
		{
			TettoPiatto(Pezzo.Gruppi[Piatti], P, Alto, FLinearColor(0.47f, 0.47f, 0.48f));
		}
		Quanti++;
	}

	// texture e materiali (uno per tipo)
	Texture = { TexturaFacciata(true), TexturaFacciata(false), TexturaCapannone(), TexturaBianca(), TexturaTegole(), TexturaBianca() };
	UMaterialInterface* Base = MaterialeEdificio ? MaterialeEdificio.Get() : UMaterial::GetDefaultMaterial(MD_Surface);
	TArray<UMaterialInterface*> Materiali;
	for (int32 i = 0; i < NumeroTipi; i++)
	{
		UMaterialInstanceDynamic* Istanza = UMaterialInstanceDynamic::Create(Base, this);
		Istanza->SetTextureParameterValue(TEXT("Facciata"), Texture[i]);
		Materiali.Add(Istanza);
	}

	for (TPair<FIntPoint, FMRWPezzoCitta>& Coppia : Citta)
	{
		UProceduralMeshComponent* Mesh = NewObject<UProceduralMeshComponent>(this);
		Mesh->bUseAsyncCooking = true;
		Mesh->SetupAttachment(RootComponent);
		Mesh->RegisterComponent();
		Mesh->SetCollisionProfileName(UCollisionProfile::BlockAll_ProfileName);
		for (int32 i = 0; i < NumeroTipi; i++)
		{
			FMRWGruppo& G = Coppia.Value.Gruppi[i];
			if (G.Vertici.Num() == 0) continue;
			// collisioni solo per i muri (i tetti non servono alla moto)
			const bool bCollisione = i <= Lisci;
			Mesh->CreateMeshSection_LinearColor(i, G.Vertici, G.Triangoli, G.Normali, G.UV, G.Colori, TArray<FProcMeshTangent>(), bCollisione);
			Mesh->SetMaterial(i, Materiali[i]);
		}
		Pezzi.Add(Mesh);
	}
	UE_LOG(LogTemp, Log, TEXT("[MRW] Edifici: %d in %d pezzi"), Quanti, Pezzi.Num());
}
